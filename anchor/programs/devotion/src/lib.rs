#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

declare_id!("coUnmi3oBUtwtd9fjeAvSsJssXh5A5xyPbhpewyzRVF");

#[program]
pub mod devotion {
    use super::*;

  pub fn close(_ctx: Context<CloseDevotion>) -> Result<()> {
    Ok(())
  }

  pub fn decrement(ctx: Context<Update>) -> Result<()> {
    ctx.accounts.devotion.count = ctx.accounts.devotion.count.checked_sub(1).unwrap();
    Ok(())
  }

  pub fn increment(ctx: Context<Update>) -> Result<()> {
    ctx.accounts.devotion.count = ctx.accounts.devotion.count.checked_add(1).unwrap();
    Ok(())
  }

  pub fn initialize(_ctx: Context<InitializeDevotion>) -> Result<()> {
    Ok(())
  }

  pub fn set(ctx: Context<Update>, value: u8) -> Result<()> {
    ctx.accounts.devotion.count = value.clone();
    Ok(())
  }
}

#[derive(Accounts)]
pub struct InitializeDevotion<'info> {
  #[account(mut)]
  pub payer: Signer<'info>,

  #[account(
  init,
  space = 8 + Devotion::INIT_SPACE,
  payer = payer
  )]
  pub devotion: Account<'info, Devotion>,
  pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct CloseDevotion<'info> {
  #[account(mut)]
  pub payer: Signer<'info>,

  #[account(
  mut,
  close = payer, // close account and return lamports to payer
  )]
  pub devotion: Account<'info, Devotion>,
}

#[derive(Accounts)]
pub struct Update<'info> {
  #[account(mut)]
  pub devotion: Account<'info, Devotion>,
}

#[account]
#[derive(InitSpace)]
pub struct Devotion {
  count: u8,
}
