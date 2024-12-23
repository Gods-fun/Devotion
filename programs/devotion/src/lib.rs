use anchor_lang::prelude::*;
use anchor_spl::{
    // associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount, Transfer, transfer, CloseAccount, close_account},
};

declare_id!("FMzU5SZEeAnP9ts9DZ9rJuFyimTfshwjQp4A3Kjm6Kf7");

pub const SECONDS_PER_DAY: i64 = 86_400;
pub const MAX_MULTIPLIER_SECONDS: i64 = SECONDS_PER_DAY * 180; // 180 days in seconds
pub const TOKEN_DECIMALS: u64 = 1_000_000_000; // 10^9

#[program]
pub mod devotion {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.stake_state;
        state.admin = ctx.accounts.admin.key();
        state.stake_mint = ctx.accounts.stake_mint.key();
        state.bump = ctx.bumps.stake_state;
        
        // Initialize total devoted
        let total_devoted = &mut ctx.accounts.total_devoted;
        total_devoted.total_tokens = 0;
        total_devoted.bump = ctx.bumps.total_devoted;
        
        Ok(())
    }

    pub fn devote(ctx: Context<Devote>, amount: u64) -> Result<()> {
        let devoted = &mut ctx.accounts.devoted;
        
        // Calculate current devotion before adding new tokens
        if devoted.amount > 0 {
            let current_time = Clock::get()?.unix_timestamp;
            let seconds_staked = current_time.saturating_sub(devoted.last_stake_timestamp);
            
            // Cap the seconds at maximum multiplier
            let capped_seconds = std::cmp::min(seconds_staked, MAX_MULTIPLIER_SECONDS);
            
            // Calculate devotion from existing stake
            let devotion = (capped_seconds as u64)
                .checked_mul(devoted.amount)
                .unwrap_or(0)
                .checked_div(TOKEN_DECIMALS)
                .unwrap_or(0)
                .checked_div(SECONDS_PER_DAY as u64)
                .unwrap_or(0);
                
            // Add to residual devotion
            devoted.residual_devotion = devoted.residual_devotion
                .checked_add(devotion)
                .unwrap_or(devoted.residual_devotion);
        } else {
            // Initialize user data if this is their first stake
            devoted.user = ctx.accounts.user.key();
        }

        // Transfer tokens from user to their vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.user_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        transfer(cpi_ctx, amount)?;

        // Update user's stake info
        devoted.amount = devoted.amount.checked_add(amount).unwrap();
        devoted.last_stake_timestamp = Clock::get()?.unix_timestamp;

        // Update total devoted
        let total_devoted = &mut ctx.accounts.total_devoted;
        total_devoted.total_tokens = total_devoted.total_tokens.checked_add(amount).unwrap();

        Ok(())
    }

    pub fn waver(ctx: Context<Waver>, amount: u64) -> Result<()> {

        // Transfer from user's vault to user
        let devoted_binding = &ctx.accounts.devoted;
        let program_id = id();
        let seeds = &[
            b"devoted".as_ref(),
            program_id.as_ref(),
            devoted_binding.user.as_ref(),
            &[ctx.bumps.devoted],
        ];
        let signer = [&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.devoted.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, &signer);
        transfer(cpi_ctx, amount)?;

        // Update user's stake info
        let devoted = &mut ctx.accounts.devoted;
        devoted.amount = devoted.amount.checked_sub(amount).unwrap();
        
        // Reset timestamp to current time and clear residual devotion
        devoted.last_stake_timestamp = Clock::get()?.unix_timestamp;
        devoted.residual_devotion = 0;

        // If user has removed all tokens, close their devoted account and vault
        if devoted.amount == 0 {
            let binding = ctx.accounts.user.key();
            // Close the vault account first
            let seeds = &[
                b"devoted".as_ref(),
                program_id.as_ref(),
                binding.as_ref(),
                &[ctx.bumps.devoted],
            ];
            let signer = [&seeds[..]];
            
            let cpi_accounts = CloseAccount {
                account: ctx.accounts.user_vault.to_account_info(),
                destination: ctx.accounts.user.to_account_info(),
                authority: ctx.accounts.devoted.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                &signer
            );
            close_account(cpi_ctx)?;

            // Then close the devoted account
            // let cpi_accounts = CloseAccount {
            //     account: ctx.accounts.devoted.to_account_info(),
            //     destination: ctx.accounts.user.to_account_info(),
            //     authority: ctx.accounts.user.to_account_info(),
            // };
            // let cpi_ctx = CpiContext::new(
            //     ctx.accounts.system_program.to_account_info(),
            //     cpi_accounts,
            // );
            // close_account(cpi_ctx)?;
        }

        // Update total devoted
        let total_devoted = &mut ctx.accounts.total_devoted;
        total_devoted.total_tokens = total_devoted.total_tokens.checked_sub(amount).unwrap();

        Ok(())
    }

    pub fn check_devotion(ctx: Context<CheckDevotion>) -> Result<u64> {
        let devoted = &ctx.accounts.devoted;
        let current_time = Clock::get()?.unix_timestamp;
        let seconds_staked = current_time.saturating_sub(devoted.last_stake_timestamp);
        
        // Cap the seconds at maximum multiplier
        let capped_seconds = std::cmp::min(seconds_staked, MAX_MULTIPLIER_SECONDS);
        
        // Calculate devotion: (seconds_staked * amount) / (token_decimals * seconds_per_day)
        let devotion = (capped_seconds as u64)
            .checked_mul(devoted.amount)
            .unwrap_or(0)
            .checked_div(TOKEN_DECIMALS)
            .unwrap_or(0)
            .checked_div(SECONDS_PER_DAY as u64)  // Normalize to devotion per day
            .unwrap_or(0);
            
        let total_devotion = devotion
            .checked_add(devoted.residual_devotion)
            .unwrap_or(devoted.residual_devotion);
            
        Ok(total_devotion)
    }
}

#[account]
#[derive(InitSpace)]
pub struct StakeState {
    pub admin: Pubkey,
    pub stake_mint: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Devoted {
    pub user: Pubkey,
    pub amount: u64,
    pub residual_devotion: u64,
    pub last_stake_timestamp: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct TotalDevoted {
    pub total_tokens: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct UserVault {
    pub user: Pubkey,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    pub stake_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        space = 8 + StakeState::INIT_SPACE,
        seeds = [b"state", id().as_ref()],
        bump,
    )]
    pub stake_state: Account<'info, StakeState>,

    #[account(
        init,
        payer = admin,
        space = 8 + TotalDevoted::INIT_SPACE, // discriminator + u64
        seeds = [b"total_devoted", id().as_ref()],
        bump,
    )]
    pub total_devoted: Account<'info, TotalDevoted>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Devote<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [b"state", id().as_ref()],
        bump,
        constraint = state.stake_mint == stake_mint.key(),
    )]
    pub state: Account<'info, StakeState>,

    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"vault", id().as_ref(), user.key().as_ref()],
        bump,
        token::mint = stake_mint,
        token::authority = devoted,
    )]
    pub user_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = stake_mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        constraint = state.stake_mint == stake_mint.key()
    )]
    pub stake_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Devoted::INIT_SPACE,
        seeds = [b"devoted", id().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub devoted: Account<'info, Devoted>,

    #[account(
        mut,
        seeds = [b"total_devoted", id().as_ref()],
        bump
    )]
    pub total_devoted: Account<'info, TotalDevoted>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Waver<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [b"state", id().as_ref()],
        bump,
        constraint = state.stake_mint == stake_mint.key(),
    )]
    pub state: Account<'info, StakeState>,

    #[account(
        mut,
        seeds = [b"vault", id().as_ref(), user.key().as_ref()],
        bump,
        token::mint = stake_mint,
        token::authority = devoted,
    )]
    pub user_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = stake_mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(constraint = state.stake_mint == stake_mint.key())]
    pub stake_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"devoted", id().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub devoted: Account<'info, Devoted>,

    #[account(
        mut,
        seeds = [b"total_devoted", id().as_ref()],
        bump,
    )]
    pub total_devoted: Account<'info, TotalDevoted>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckDevotion<'info> {
    pub devoted: Account<'info, Devoted>,
}