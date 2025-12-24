# Play-Prediction: Complete User Guide

**Welcome to Play-Prediction!** This guide will help you understand how to use the platform, whether you're a regular user making predictions or an administrator managing markets.

---

## Table of Contents

1. [What is Play-Prediction?](#1-what-is-play-prediction)
2. [Getting Started](#2-getting-started)
3. [Understanding Prediction Markets](#3-understanding-prediction-markets)
4. [How to Trade](#4-how-to-trade)
5. [Managing Your Portfolio](#5-managing-your-portfolio)
6. [Admin Features](#6-admin-features)
7. [Frequently Asked Questions](#7-frequently-asked-questions)

---

## 1. What is Play-Prediction?

Play-Prediction is a **prediction market platform** where you can bet on the outcomes of real-world events using virtual Points. Think of it as a stock market for predictions!

### Key Features

✅ **Trade on Real Events** - Sports, politics, crypto prices, weather, and more  
✅ **Always Available** - Trade 24/7 without waiting for someone to match your bet  
✅ **Fair Pricing** - Prices adjust automatically based on what everyone thinks will happen  
✅ **Virtual Points** - Practice and compete without risking real money  
✅ **Live Updates** - See prices change in real-time as others trade  
✅ **Track Your Performance** - View your positions, profits, and trading history

### Important: Virtual Points System

> **This platform uses virtual Points, not real money.**
> 
> - Points are the in-platform currency for all trading
> - You receive **100 Points for free** when you sign up
> - Points **cannot be withdrawn** or exchanged for real currency
> - Administrators can grant additional Points for contests or promotions
> - This is designed for entertainment and skill-building

---

## 2. Getting Started

### Step 1: Create Your Account

1. Click **"Sign Up"** on the homepage
2. Enter your email address and create a password
3. Check your email and click the confirmation link
4. You're in! You'll automatically receive **100 Points** to start trading

### Step 2: Explore Markets

Once logged in, you'll see the **Markets** page with all available prediction markets:

- **Active Markets**: Currently open for trading
- **Resolved Markets**: Already decided with winners paid out
- **Categories**: Filter by Sports, Politics, Crypto, Weather, etc.

### Step 3: Make Your First Trade

1. Click on any market that interests you
2. Review the question and details
3. Decide if you think the answer is **YES** or **NO**
4. Enter how many Points you want to spend
5. Click **"Buy YES"** or **"Buy NO"**
6. Confirm your trade!

---

## 3. Understanding Prediction Markets

### What is a Prediction Market?

A prediction market is like a betting exchange where prices reflect what people collectively believe will happen. The more people think something will happen, the higher its price.

### How Do Prices Work?

Every market has two options: **YES** and **NO**

- Prices are shown as percentages (e.g., YES: 65%, NO: 35%)
- These represent the market's collective belief about the outcome
- **YES + NO always equals 100%**
- Prices change as people trade

**Example:**
```
Market: "Will it rain tomorrow in NYC?"
YES: 70¢  (70% chance)
NO: 30¢   (30% chance)
```

If you think it's more likely to rain than 70%, you might buy YES shares. If you think it's less likely, you might buy NO shares.

### What Are Shares?

When you trade, you buy **shares** representing your prediction:

- **YES shares**: You think the event will happen
- **NO shares**: You think the event won't happen
- If you're right when the market resolves, each winning share pays **1 Point**
- If you're wrong, your shares are worth nothing

**Example:**
- You buy 50 YES shares for 35 Points (70¢ per share)
- The event happens → You get 50 Points back
- **Profit: 15 Points** (50 - 35)

### How Does the Platform Provide Liquidity?

Unlike traditional betting where you need someone to take the opposite side of your bet, Play-Prediction uses an **Automated Market Maker (AMM)**:

- The platform always has shares available to buy or sell
- Prices adjust automatically based on supply and demand
- Large trades move the price more than small trades (called "price impact")
- You can trade instantly without waiting for a match

#### What is Seed Liquidity?

When an admin creates a market, they deposit **seed liquidity** - an initial pool of Points that gets converted into YES and NO shares. This is what makes instant trading possible from the very first trade.

**Example: Creating a market with 100 Points seed liquidity**

1. Admin deposits 100 Points from the treasury
2. System creates 100 YES shares + 100 NO shares
3. Pool starts with: 100 YES, 100 NO
4. Initial prices: YES: 50¢, NO: 50¢

**Why it matters:**

| More Seed Liquidity | Less Seed Liquidity |
|---------------------|---------------------|
| ✅ Lower price impact on trades | ❌ Higher price impact |
| ✅ Better prices for everyone | ❌ Worse prices |
| ✅ Can handle larger trades | ❌ Large trades move price a lot |

**Example of price impact:**

```
Market A (100 Points seed):
- You buy 10 YES shares
- Price moves from 50¢ to ~55¢
- Price impact: ~10%

Market B (1,000 Points seed):
- You buy 10 YES shares  
- Price moves from 50¢ to ~50.5¢
- Price impact: ~1%
```

**The AMM as Your Trading Partner:**

Think of the seed liquidity as creating a "robot trader" that:
- Always has shares to sell you
- Always willing to buy shares from you
- Adjusts prices automatically based on what everyone is trading
- Never sleeps - available 24/7

Without seed liquidity, the pool would be empty and no one could trade. The seed liquidity is what makes the AMM work!

---

## 4. How to Trade

### Understanding the Trade Form

When you open a market, you'll see the trade form with:

1. **Current Prices**: Live YES and NO prices
2. **Side Selector**: Choose YES or NO
3. **Amount Input**: How many Points to spend
4. **Estimated Shares**: How many shares you'll receive
5. **Price Impact**: How much your trade will move the price
6. **Fees**: 2% fee on all buys and sells
7. **Slippage Protection**: Maximum price change you'll accept

### Trading Operations

#### 1. Buying Shares (Most Common)

**When to use**: You want to bet on an outcome

**How it works**:
1. Select **YES** or **NO**
2. Enter Points to spend (e.g., 10 Points)
3. See estimated shares you'll receive (e.g., ~14 shares at 70¢)
4. Click **"Buy"**
5. A 2% fee is deducted from your Points before the trade

**Example**:
```
You spend: 10 Points
Fee (2%): 0.20 Points
Net amount: 9.80 Points
YES price: 70¢
Shares received: ~14 YES shares
```

#### 2. Selling Shares

**When to use**: You want to cash out before the market resolves

**How it works**:
1. Go to your **Portfolio**
2. Find the market position
3. Click **"Sell"**
4. Enter how many shares to sell
5. See estimated Points you'll receive
6. Click **"Confirm"**
7. A 2% fee is deducted from your payout

**Example**:
```
You sell: 14 YES shares
Current price: 80¢
Gross payout: 11.20 Points
Fee (2%): 0.22 Points
Net payout: 10.98 Points
```

#### 3. Minting Complete Sets (Advanced)

**When to use**: You want to create shares without moving the price

**How it works**:
- Spend 1 Point to create 1 YES share + 1 NO share
- No fees
- Useful if you want to sell one side immediately

**Example**:
```
You spend: 5 Points
You receive: 5 YES shares + 5 NO shares
Then you can sell the NO shares to keep only YES
```

#### 4. Merging Complete Sets (Advanced)

**When to use**: You want to exit a position without price impact

**How it works**:
- Combine 1 YES share + 1 NO share to get 1 Point back
- No fees
- Only works if you have both YES and NO shares

**Example**:
```
You have: 5 YES shares + 5 NO shares
You merge them
You receive: 5 Points back
```

### Understanding Fees

All trades have a **2% fee** split as follows:

| Fee Component | Amount | Where It Goes |
|---------------|--------|---------------|
| Vault Fee | 1% | Logged to audit trail (not transferred to any account) |
| Liquidity Fee | 1% | Injected back into the pool (increases market depth) |

**Important**: 
- Fees are charged on **buys** (deducted from your Points before trading)
- Fees are charged on **sells** (deducted from your payout)
- **No fees** on minting or merging complete sets

### Slippage Protection

**What is slippage?** The difference between the expected price and the actual price you get.

**Why does it happen?** Large trades move the market price.

**How to protect yourself**:
- The trade form shows **"Minimum Shares Out"** for buys
- This is the least amount of shares you'll accept
- If the price moves too much, the trade is rejected
- You can adjust the slippage tolerance (default: 1%)

**Example**:
```
You want to buy YES shares
Expected: 14 shares
Minimum accepted: 13.86 shares (1% slippage)
If price moves and you'd get less than 13.86, trade fails
```

---

## 5. Managing Your Portfolio

### Viewing Your Positions

Click **"Portfolio"** to see:

- **Active Positions**: Markets you're currently invested in
- **Position Details**: How many shares you hold (YES or NO)
- **Cost Basis**: How much you originally spent
- **Current Value**: What your shares are worth now
- **Unrealized P&L**: Your profit or loss if you sold now

**Example Position**:
```
Market: "Will BTC exceed $100k?"
Position: 50 YES shares
Cost Basis: 35 Points (bought at 70¢ per share)
Current Price: 80¢
Current Value: 40 Points (50 × 0.80)
Unrealized P&L: +5 Points (40 - 35)
```

### Understanding Profit & Loss

**Unrealized P&L**: Profit/loss on positions you still hold
```
Unrealized P&L = (Current Value) - (Cost Basis)
```

**Realized P&L**: Profit/loss from closed positions
- When you sell shares
- When a market resolves and you get paid

### Trade History

View all your past trades:
- **Date & Time**: When the trade happened
- **Market**: Which market you traded
- **Action**: Buy, Sell, Mint, or Merge
- **Side**: YES or NO
- **Amount**: Points spent or received
- **Shares**: Shares bought or sold
- **Fee**: Fee paid

### Filters & Export

- Filter by market, date range, or trade type
- Export your history to CSV for record-keeping
- Search for specific trades

---

## 6. Admin Features

If you're an administrator, you have additional capabilities to manage the platform.

### Admin Dashboard

Access the admin panel to see:

- **Platform Statistics**
  - Total users and active users (last 7 days)
  - Total markets by status
  - Trading volume (total and 24-hour)
  - Platform health metrics

- **Quick Actions**
  - Create new markets
  - Manage existing markets
  - Grant Points to users
  - View audit logs

### Creating Markets

**Step-by-step**:

1. Click **"Create Market"** in the admin panel
2. Fill in the market details:
   - **Title**: Clear question (e.g., "Will it rain tomorrow in NYC?")
   - **Description**: Full details, resolution criteria, sources
   - **Category**: Sports, Politics, Crypto, Weather, etc.
   - **Image**: Upload a relevant image
   - **Close Time**: When trading should stop
   - **Close Behavior**: How the market should close (see below)

3. Set initial liquidity:
   - **Seed Amount**: How many Points to seed the market (e.g., 100 Points)
   - **Initial YES Price**: Starting probability (default: 50%)
   - Example: 30% YES creates a market that starts at YES: 30¢, NO: 70¢

4. Click **"Create"** - market starts in DRAFT status

#### Understanding Seed Liquidity

**What happens when you seed a market:**

When you create a market with 100 Points seed at 50/50:
1. System creates 100 YES shares + 100 NO shares
2. Grants these shares to the **treasury account's portfolio**
3. Pool starts ready for trading with these shares
4. Prices: YES: 50¢, NO: 50¢

> **Important**: The treasury's **Points balance is NOT deducted**. Instead, the system creates shares via a `GENESIS_MINT` operation and grants them to the treasury's portfolio. Think of it as the treasury "printing" shares rather than buying them. The treasury is a special platform account (user with `role = 'treasury'`) that holds these shares.

**Choosing the right seed amount:**

| Seed Amount | Best For | Price Impact |
|-------------|----------|--------------|
| 10-50 Points | Low-volume markets, testing | High (5-20%) |
| 100-500 Points | Regular markets | Medium (1-5%) |
| 1,000+ Points | High-volume, popular events | Low (<1%) |

**Skewed Genesis (Non-50/50 Start):**

You can create markets that don't start at 50/50 by setting the initial YES price:

```
Example 1: Underdog scenario
Seed: 100 Points
Initial YES Price: 30%
Result: Market starts at YES: 30¢, NO: 70¢
Use case: "Will the underdog team win?"

Example 2: Likely outcome
Seed: 100 Points  
Initial YES Price: 80%
Result: Market starts at YES: 80¢, NO: 20¢
Use case: "Will it be sunny tomorrow?" (in a desert)
```

**Where do the shares go:**

- **During trading**: Shares sit in the liquidity pool, available for users to trade against
- **Treasury portfolio**: Treasury holds the shares in its portfolio (not Points)
- **On resolution**: Winners get paid from the pool, treasury keeps any remaining shares
- **On cancellation**: Users refunded, treasury portfolio cleared

### Market Close Behavior

Choose how the market should close when the close time arrives:

| Behavior | When to Use | Example |
|----------|-------------|---------|
| **Auto** | Events with exact end times | "BTC price at 5PM UTC" |
| **Manual** | Events with variable end times | Soccer matches (added time varies) |
| **Auto with Buffer** | Events that might run over | Basketball (30-min overtime buffer) |

**Why this matters**: 
- Soccer matches can have 1-15+ minutes of added time
- Using "Manual" prevents the market from closing during a potential winning goal
- Admin must manually close when the event actually ends

### Managing Markets

#### Activating Markets

- Markets start in **DRAFT** status
- Review all details carefully
- Click **"Activate"** to make it live for trading
- Once active, users can start trading

#### Pausing Markets

**When to pause**:
- Suspicious trading activity
- Need to investigate an issue
- Event is delayed or postponed

**How to pause**:
1. Go to market details
2. Click **"Pause Market"**
3. Trading stops immediately
4. You can resume later or resolve/cancel

#### Resuming Markets

- Click **"Resume"** on a paused market
- Trading resumes immediately
- Use this after resolving the issue

#### Extending Close Time

**When to use**: Event is delayed or needs more time

**How to extend**:
1. Go to market details
2. Click **"Extend Close Time"**
3. Enter new close time (must be in the future)
4. Confirm - market stays open longer

### Resolving Markets

**When the event outcome is known**:

1. Go to market details
2. Click **"Resolve Market"**
3. Select the outcome:
   - **YES**: YES holders win
   - **NO**: NO holders win
4. Confirm resolution
5. System automatically:
   - Pays winners 1 Point per share
   - Clears all positions
   - Logs everything to audit trail

**Post-Event Trade Voiding**:
- If trades happened after the event ended, they're automatically voided
- Example: Market closes at 9PM, event ended at 8:55PM
- Trades between 8:55PM and 9PM are reversed
- Ensures fairness

### Cancelling Markets

**When to cancel**:
- Event is cancelled
- Market question is ambiguous
- Technical issue makes fair resolution impossible

**How to cancel**:
1. Go to market details
2. Click **"Cancel Market"**
3. Confirm cancellation
4. System automatically:
   - Refunds everyone at their cost basis
   - Clears all positions
   - Tracks any surplus to treasury

**Example**:
```
User A bought 10 YES for 7 Points → Gets 7 Points back
User B bought 5 NO for 1.5 Points → Gets 1.5 Points back
Everyone gets their money back
```

### User Management

**View All Users**:
- Search by email or role
- Filter by user type (user, admin)
- View user statistics:
  - Total trades
  - Trading volume
  - Active positions
  - Points granted

**View User Details**:
- Click on any user to see:
  - Account information
  - Trading statistics
  - Position history
  - Point grant history

### Granting Points

**When to grant Points**:
- Contest winners
- Promotional rewards
- Balance corrections
- User compensation

**How to grant**:
1. Go to **"User Management"**
2. Find the user (search by email)
3. Click **"Grant Points"**
4. Enter:
   - **Amount**: How many Points to grant
   - **Reason**: Why you're granting (required for audit)
   - **Grant Type**: ADMIN_GRANT, PROMOTION, or CORRECTION
5. Confirm - Points added immediately

**Audit Trail**:
- Every grant is logged
- Shows: who granted, to whom, amount, reason, timestamp
- Cannot be deleted or modified

### Audit Logs

**View all admin actions**:
- Market creation, activation, resolution
- Point grants
- Market modifications
- User actions

**Filter logs**:
- By action type (create, resolve, grant, etc.)
- By admin (who performed the action)
- By date range
- By market or user

**Export logs**:
- Download as CSV
- Use for compliance or reporting

### Admin Statistics

**Platform Overview**:
- **Users**: Total registered, active in last 7 days
- **Markets**: 
  - Total markets
  - Active markets (currently trading)
  - Pending resolution (closed but not resolved)
  - Resolved markets
  - Cancelled markets
- **Trading Volume**:
  - Total volume (all time)
  - 24-hour volume
  - Number of trades

**Market Details**:
- Holders count (unique users with positions)
- Total volume per market
- Creator information
- Category distribution

---

## 7. Frequently Asked Questions

### General Questions

**Q: Is this real money?**  
A: No, Play-Prediction uses virtual Points that have no cash value. You cannot withdraw or exchange Points for real currency.

**Q: How do I get more Points?**  
A: You receive 100 Points when you sign up. Administrators can grant additional Points for contests, promotions, or other reasons.

**Q: Can I lose my Points?**  
A: Yes, if you make incorrect predictions, you can lose the Points you invested. However, since they're virtual, you're not risking real money.

**Q: How are prices determined?**  
A: Prices are determined by an Automated Market Maker algorithm based on supply and demand. When more people buy YES, the YES price goes up.

### Trading Questions

**Q: Why do prices change when I trade?**  
A: Large trades move the market price. This is called "price impact." The bigger your trade relative to the market size, the more the price moves.

**Q: What's the minimum trade size?**  
A: The minimum is 0.001 Points (1,000 MicroPoints).

**Q: Can I cancel a trade?**  
A: No, trades are final once executed. However, you can always sell your shares before the market resolves.

**Q: What happens if I hold both YES and NO shares?**  
A: You can merge them to get your Points back (1 YES + 1 NO = 1 Point). This is useful for exiting positions without price impact.

**Q: Why did my trade fail?**  
A: Common reasons:
- Insufficient balance
- Slippage exceeded (price moved too much)
- Market is paused or resolved
- Trade size too small (below minimum)

### Market Questions

**Q: When do markets close?**  
A: Each market has a "Close Time" shown on the market page. Some markets close automatically, others require admin action.

**Q: What happens when a market closes?**  
A: Trading stops, but the market isn't resolved yet. The admin will resolve it once the outcome is known.

**Q: How long does resolution take?**  
A: It depends on the event. Some resolve immediately (e.g., "BTC price at 5PM"), others may take days (e.g., election results).

**Q: What if the event is cancelled?**  
A: The admin will cancel the market and everyone gets refunded at their cost basis (the amount they originally spent).

**Q: Can I suggest a market?**  
A: Contact the admin team with your suggestion! They'll review it and may create the market.

### Portfolio Questions

**Q: What is "Cost Basis"?**  
A: The total amount you've invested in a position. If you bought 10 shares for 7 Points, your cost basis is 7 Points.

**Q: What is "Unrealized P&L"?**  
A: Your profit or loss if you sold your position right now. It's "unrealized" because you haven't actually sold yet.

**Q: How do I calculate my potential profit?**  
A: 
```
If you win: (Shares × 1 Point) - Cost Basis = Profit
If you lose: -Cost Basis = Loss
```

**Q: Can I have positions in multiple markets?**  
A: Yes! You can trade in as many markets as you want, as long as you have Points available.

### Technical Questions

**Q: Why do I see prices update in real-time?**  
A: The platform uses WebSocket technology to push live updates to your browser whenever someone trades.

**Q: What if I lose my internet connection during a trade?**  
A: The platform uses idempotency keys to prevent duplicate trades. If your connection drops, you can safely retry.

**Q: Is my data secure?**  
A: Yes, the platform uses industry-standard security:
- Encrypted connections (HTTPS)
- Secure authentication (Supabase Auth)
- Session-based security
- Rate limiting to prevent abuse

**Q: Can I use the platform on mobile?**  
A: Yes! The web interface is mobile-responsive and works on phones and tablets.

### Admin Questions

**Q: How do I become an admin?**  
A: Contact the platform owner. Admin access is granted manually for security reasons.

**Q: Can I edit a market after it's active?**  
A: You can update the description and extend the close time, but you cannot change the fundamental question or resolution criteria.

**Q: What if I resolve a market incorrectly?**  
A: Contact technical support immediately. Incorrect resolutions are serious and may require database intervention.

**Q: How do I handle disputes?**  
A: Review the market's resolution criteria carefully. If the outcome is genuinely ambiguous, consider cancelling the market to refund everyone.

**Q: Can I delete a market?**  
A: No, markets cannot be deleted (for audit purposes). You can only cancel them, which refunds all participants.

**Q: Does seed liquidity come from my admin Points balance?**  
A: No, seed liquidity is deducted from the **treasury account**, not your personal admin balance. The treasury is a special platform account that holds capital for market operations. When markets resolve or are cancelled, the remaining liquidity returns to the treasury.

---

## Need Help?

If you have questions not covered in this guide:

- **Users**: Contact support or check the FAQ section
- **Admins**: Refer to the admin documentation or contact technical support

---

**Last Updated**: December 2025  
**Version**: 1.0

Happy predicting! 🎯
