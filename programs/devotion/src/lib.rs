use anchor_lang::prelude::*;
use anchor_spl::{
    // associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount, Transfer, transfer, CloseAccount, close_account},
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

pub const SECONDS_PER_DAY: i64 = 86_400;
pub const MAX_MULTIPLIER_SECONDS: i64 = SECONDS_PER_DAY * 180; // 180 days in seconds
pub const TOKEN_DECIMALS: u64 = 1_000_000_000; // 10^9

#[program]
pub mod devotion {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.admin = ctx.accounts.admin.key();
        state.stake_mint = ctx.accounts.stake_mint.key();
        state.vault_bump = ctx.bumps.vault;
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
        }

        // Transfer tokens from user to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        transfer(cpi_ctx, amount)?;

        // Update user's stake info
        devoted.amount = devoted.amount.checked_add(amount).unwrap();
        devoted.user = ctx.accounts.user.key();
        devoted.last_stake_timestamp = Clock::get()?.unix_timestamp;

        Ok(())
    }

    pub fn waver(ctx: Context<Waver>, amount: u64) -> Result<()> {
        let state = &ctx.accounts.state;
        
        // Transfer from vault to user
        let seeds = &[
            b"vault".as_ref(),
            state.stake_mint.as_ref(),
            &[state.vault_bump],
        ];
        let signer = [&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
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

        // If user has removed all tokens, close their devoted account
        if devoted.amount == 0 {
            let cpi_accounts = CloseAccount {
                account: ctx.accounts.devoted.to_account_info(),
                destination: ctx.accounts.user.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            };
            let cpi_ctx = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                cpi_accounts,
            );
            close_account(cpi_ctx)?;
        }

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
pub struct StakeState {
    pub admin: Pubkey,
    pub stake_mint: Pubkey,
    pub vault_bump: u8,
}

#[account]
pub struct Devoted {
    pub user: Pubkey,
    pub amount: u64,
    pub residual_devotion: u64,
    pub last_stake_timestamp: i64,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    pub stake_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 32 + 1
    )]
    pub state: Account<'info, StakeState>,

    #[account(
        init,
        payer = admin,
        seeds = [b"vault", stake_mint.key().as_ref()],
        bump,
        token::mint = stake_mint,
        token::authority = vault,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Devote<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub state: Account<'info, StakeState>,

    #[account(
        mut,
        seeds = [b"vault", state.stake_mint.as_ref()],
        bump = state.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = stake_mint,
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub stake_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 32 + 8 + 8,
        seeds = [b"devoted", user.key().as_ref()],
        bump
    )]
    pub devoted: Account<'info, Devoted>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Waver<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub state: Account<'info, StakeState>,

    #[account(
        mut,
        seeds = [b"vault", state.stake_mint.as_ref()],
        bump = state.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = stake_mint,
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub stake_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"devoted", user.key().as_ref()],
        bump,
        constraint = devoted.user == user.key()
    )]
    pub devoted: Account<'info, Devoted>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckDevotion<'info> {
    pub devoted: Account<'info, Devoted>,
}