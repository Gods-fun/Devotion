use anchor_lang::prelude::*;
use anchor_spl::{
    // associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount, Transfer, transfer},
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

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

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
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
        let user_stake = &mut ctx.accounts.user_stake;
        user_stake.amount = user_stake.amount.checked_add(amount).unwrap();
        user_stake.user = ctx.accounts.user.key();
        user_stake.last_stake_timestamp = Clock::get()?.unix_timestamp;

        Ok(())
    }

    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
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
        let user_stake = &mut ctx.accounts.user_stake;
        user_stake.amount = user_stake.amount.checked_sub(amount).unwrap();

        Ok(())
    }
}

#[account]
pub struct StakeState {
    pub admin: Pubkey,
    pub stake_mint: Pubkey,
    pub vault_bump: u8,
}

#[account]
pub struct UserStake {
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
pub struct Stake<'info> {
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
        seeds = [b"user_stake", user.key().as_ref()],
        bump
    )]
    pub user_stake: Account<'info, UserStake>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
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
        seeds = [b"user_stake", user.key().as_ref()],
        bump,
        constraint = user_stake.user == user.key()
    )]
    pub user_stake: Account<'info, UserStake>,

    pub token_program: Program<'info, Token>,
}