use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer, transfer};

declare_id!("GodsAfuZbVYY79KADVMe39ZwybWuL5U6RFLvyzUD5qgw");

#[program]
pub mod devotion {
    use super::*;

    // initialization of the program state checks the safety of max devotion
    pub fn initialize(
        ctx: Context<Initialize>, 
        interval: i64,
        max_devotion_charge: i64,
    ) -> Result<()> {
        // Validate interval and max_devotion_charge
        if interval <= 0 {
            return Err(ErrorCode::InvalidInterval.into());
        }
        if max_devotion_charge <= 0 {
            return Err(ErrorCode::InvalidMaxDevotionCharge.into());
        }

        // Check if max_devotion calculation could overflow using u128
        let decimals_multiplier = 10u128.pow(ctx.accounts.stake_mint.decimals as u32);
        
        // Check if max_devotion_charge * U64::MAX would overflow when converted to u128
        (u128::from(u64::MAX))
            .checked_mul(max_devotion_charge as u128)
            .ok_or(ErrorCode::MaxDevotionOverflow)?
            .checked_div(decimals_multiplier)
            .ok_or(ErrorCode::DivError)?
            .checked_div(interval as u128)
            .ok_or(ErrorCode::DivError)?;

        let state = &mut ctx.accounts.stake_state;
        state.admin = ctx.accounts.admin.key();
        state.stake_mint = ctx.accounts.stake_mint.key();
        state.decimals = ctx.accounts.stake_mint.decimals;
        state.interval = interval;
        state.max_devotion_charge = max_devotion_charge;
        
        // Initialize total devoted
        let total_devoted = &mut ctx.accounts.total_devoted;
        total_devoted.total_tokens = 0;
        
        Ok(())
    }

    pub fn devote(ctx: Context<Devote>, amount: u64) -> Result<()> {
        if amount == 0 {
            return Err(ErrorCode::AmountZero.into());
        }

        let devoted = &mut ctx.accounts.devoted;
        
        // Calculate current devotion before adding new tokens
        if devoted.amount > 0 {
            let current_time = Clock::get()?.unix_timestamp;
            let seconds_staked = current_time.saturating_sub(devoted.last_stake_timestamp);
            
            // Cap the seconds at maximum multiplier using stake_state value
            let capped_seconds = std::cmp::min(seconds_staked, ctx.accounts.stake_state.max_devotion_charge);
            
            // Calculate current devotion using u128
            let decimals_multiplier = 10u128.pow(ctx.accounts.stake_state.decimals as u32);
            let calculated_devotion = (capped_seconds as u128)
                .checked_mul(devoted.amount as u128)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(decimals_multiplier)
                .ok_or(ErrorCode::DivError)?
                .checked_div(ctx.accounts.stake_state.interval as u128)
                .ok_or(ErrorCode::DivError)?;
                
            // Add residual_devotion to get current_devotion
            let current_devotion = calculated_devotion
                .checked_add(devoted.residual_devotion)
                .ok_or(ErrorCode::MathOverflow)?;
                
            // Calculate max_devotion using u128
            let max_devotion = (devoted.amount as u128)
                .checked_mul(ctx.accounts.stake_state.max_devotion_charge as u128)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(decimals_multiplier)
                .ok_or(ErrorCode::DivError)?
                .checked_div(ctx.accounts.stake_state.interval as u128)
                .ok_or(ErrorCode::DivError)?;
                
            // Store the capped current_devotion as residual_devotion
            devoted.residual_devotion = std::cmp::min(current_devotion, max_devotion);
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
        devoted.amount = devoted.amount
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;
        devoted.last_stake_timestamp = Clock::get()?.unix_timestamp;

        // Update total devoted
        let total_devoted = &mut ctx.accounts.total_devoted;
        total_devoted.total_tokens = total_devoted.total_tokens
            .checked_add(amount)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(())
    }

    pub fn waver(ctx: Context<Waver>, amount: u64) -> Result<()> {

        if amount == 0 {
            // custom error
            return Err(ErrorCode::AmountZero.into());
        }

        // Transfer from user's vault to user
        let devoted_binding = &ctx.accounts.devoted;
        let seeds = &[
            b"devoted".as_ref(),
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
        devoted.amount = devoted.amount
            .checked_sub(amount)
            .ok_or(ErrorCode::InsufficientFunds)?;
        
        // Reset timestamp to current time
        devoted.last_stake_timestamp = Clock::get()?.unix_timestamp;
        
        // Always reset residual_devotion to 0
        devoted.residual_devotion = 0;

        // Update total devoted
        let total_devoted = &mut ctx.accounts.total_devoted;
        total_devoted.total_tokens = total_devoted.total_tokens
            .checked_sub(amount)
            .ok_or(ErrorCode::MathUnderflow)?;

        Ok(())
    }

    pub fn heresy(ctx: Context<Heresy>) -> Result<()> {
        if ctx.accounts.user_vault.amount == 0 {
            // custom error
            return Err(ErrorCode::VaultZero.into());
        }

        if ctx.accounts.devoted.amount == 0 {
            // custom error
            return Err(ErrorCode::DevotionZero.into());
        }

        // If there are tokens in the vault, transfer them back to user
        if ctx.accounts.user_vault.amount > 0 {
            // Transfer all tokens from vault to user
            let devoted_binding = &ctx.accounts.devoted;
            let seeds = &[
                b"devoted".as_ref(),
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
            transfer(cpi_ctx, ctx.accounts.user_vault.amount)?;

            // Update total devoted
            let total_devoted = &mut ctx.accounts.total_devoted;
            total_devoted.total_tokens = total_devoted.total_tokens
                .checked_sub(ctx.accounts.user_vault.amount)
                .ok_or(ErrorCode::MathUnderflow)?;
        }

        Ok(())
    }

    pub fn check_devotion(ctx: Context<CheckDevotion>) -> Result<u128> {
        let devoted = &ctx.accounts.devoted;
        let stake_state = &ctx.accounts.stake_state;
        let current_time = Clock::get()?.unix_timestamp;
        let seconds_staked = current_time.saturating_sub(devoted.last_stake_timestamp);
        
        // Cap the seconds at maximum multiplier using stake_state value
        let capped_seconds = std::cmp::min(seconds_staked, stake_state.max_devotion_charge);
        
        // Calculate using u128
        let decimals_multiplier = 10u128.pow(stake_state.decimals as u32);
        let max_devotion = (devoted.amount as u128)
            .checked_mul(stake_state.max_devotion_charge as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(decimals_multiplier)
            .ok_or(ErrorCode::DivError)?
            .checked_div(stake_state.interval as u128)
            .ok_or(ErrorCode::DivError)?;
        
        // Calculate current devotion
        let devotion = (capped_seconds as u128)
            .checked_mul(devoted.amount as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(decimals_multiplier)
            .ok_or(ErrorCode::DivError)?
            .checked_div(stake_state.interval as u128)
            .ok_or(ErrorCode::DivError)?;
            
        let total_devotion = devotion
            .checked_add(devoted.residual_devotion)
            .ok_or(ErrorCode::MathOverflow)?;
            
        // Return the minimum of total_devotion and max_devotion
        Ok(std::cmp::min(total_devotion, max_devotion))
    }
}

#[account]
#[derive(InitSpace)]
pub struct StakeState {
    pub admin: Pubkey,
    pub stake_mint: Pubkey,
    pub interval: i64,
    pub max_devotion_charge: i64,
    pub decimals: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Devoted {
    pub user: Pubkey,
    pub amount: u64,
    pub residual_devotion: u128,
    pub last_stake_timestamp: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct TotalDevoted {
    pub total_tokens: u64,
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
        seeds = [b"state"],
        bump,
    )]
    pub stake_state: Account<'info, StakeState>,

    #[account(
        init,
        payer = admin,
        space = 8 + TotalDevoted::INIT_SPACE,
        seeds = [b"total_devoted"],
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
        seeds = [b"state"],
        bump,
        constraint = stake_state.stake_mint == stake_mint.key(),
    )]
    pub stake_state: Account<'info, StakeState>,

    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"vault", user.key().as_ref()],
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
        constraint = stake_state.stake_mint == stake_mint.key()
    )]
    pub stake_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Devoted::INIT_SPACE,
        seeds = [b"devoted", user.key().as_ref()],
        bump,
    )]
    pub devoted: Account<'info, Devoted>,

    #[account(
        mut,
        seeds = [b"total_devoted"],
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
        seeds = [b"state"],
        bump,
        constraint = stake_state.stake_mint == stake_mint.key(),
    )]
    pub stake_state: Account<'info, StakeState>,

    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
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

    #[account(constraint = stake_state.stake_mint == stake_mint.key())]
    pub stake_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"devoted", user.key().as_ref()],
        bump,
    )]
    pub devoted: Account<'info, Devoted>,

    #[account(
        mut,
        seeds = [b"total_devoted"],
        bump,
    )]
    pub total_devoted: Account<'info, TotalDevoted>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckDevotion<'info> {
    pub devoted: Account<'info, Devoted>,
    #[account(
        seeds = [b"state"],
        bump
    )]
    pub stake_state: Account<'info, StakeState>,
}

#[derive(Accounts)]
pub struct Heresy<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
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

    // maybe we need a stake mint constraint here like the other functions?
    pub stake_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"devoted", user.key().as_ref()],
        bump,
        close = user
    )]
    pub devoted: Account<'info, Devoted>,

    #[account(
        mut,
        seeds = [b"total_devoted"],
        bump,
    )]
    pub total_devoted: Account<'info, TotalDevoted>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Amount cannot be zero")]
    AmountZero,

    #[msg("Vault cannot be zero")]
    VaultZero,

    #[msg("Devotion cannot be zero")]
    DevotionZero,

    #[msg("Math operation overflow")]
    MathOverflow,

    #[msg("Math operation underflow")]
    MathUnderflow,

    #[msg("Insufficient funds for operation")]
    InsufficientFunds,

    #[msg("Division error")]
    DivError,

    #[msg("Invalid interval value")]
    InvalidInterval,
    
    #[msg("Invalid max devotion charge value")]
    InvalidMaxDevotionCharge,
    
    #[msg("Max devotion calculation would overflow")]
    MaxDevotionOverflow,
}