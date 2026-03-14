# SupaPets Master Project File

## 1) Project Overview

- **Game concept:** Virtual pet game starting from eggs. Users care for pets daily, pets evolve and level up, and players earn Supapi Credit.
- **Currency:** Supapi Credit (`100 credits = $1 USD`).
- **Funding flow:** Users buy credits using Pi, then spend credits in-game.

## 2) Pet Roster (10 Types)

| No | Pet Name | Type | Special Trait | Hatch Time |
| --- | --- | --- | --- | --- |
| 1 | Fluffy | Cat | Plays with yarn, loves naps | 12h |
| 2 | Barky | Dog | Can fetch small items, friendly | 12h |
| 3 | Hoppy | Rabbit | Extra energy, fast growth | 10h |
| 4 | Scaly | Dragon | Fire breath, rare evolve path | 24h |
| 5 | Chirpy | Bird | Can sing for credits | 8h |
| 6 | Slither | Snake | Sneaky, unlocks secret items | 10h |
| 7 | Fins | Fish | Calm, requires water tank care | 6h |
| 8 | Horn | Unicorn | Magical powers, rare items | 24h |
| 9 | Spot | Dalmatian | Special spots pattern, playful | 12h |
| 10 | Pebble | Turtle | Slow but long lifespan, rare evolve | 18h |

## 3) Pet Stats

Each pet tracks:

- **Hunger:** `0-100`
- **Happiness:** `0-100`
- **Health:** `0-100`
- **Energy:** `0-100`

## 4) Core Game Loop

1. User buys Pi -> converts to Supapi Credit -> wallet top-up.
2. User chooses egg -> hatch pet.
3. Daily care actions (`Feed`, `Play`, `Clean`, `Sleep`) improve stats and grant credit rewards.
4. Mini-games provide extra credits.
5. User spends credits on food, toys, customizations, premium pets.
6. Pet evolves / achievements unlock bonus credits.
7. Repeat daily for streak and loyalty bonuses.

## 5) Reward and Cost Suggestions

- **Daily login / care rewards:** `10-500` credits
- **Mini-game rewards:** `5-100` credits
- **Food / toy costs:** `5-50` credits
- **Customization costs:** `20-200` credits
- **Premium / rare pets:** `200-5000` credits

## 6) Optional Economy Features

- Marketplace for trading pets/items using credits.
- Boosters for temporary stat boosts.
- Leaderboard and achievements.

## 7) UI Layout Ideas

- **Home screen:** Show all pets and eggs.
- **Pet screen:** Stat bars + action buttons (`Feed`, `Play`, `Clean`, `Sleep`).
- **Inventory:** Food, toys, rare items.
- **Shop:** Buy items, skins, premium pets using credits.
- **Rewards:** Daily login, achievements, streaks.

## 8) Notes

- Economy should be scalable based on rarity and level.
- AI behavior can be added optionally for dynamic pet interactions.
- Pi Network integration for credit purchase can be enabled as optional module.

## 9) Suggested Next Build Phases

### Phase 1 (MVP)
- Egg selection and hatching timer.
- Single pet profile with core stats.
- Daily care actions with cooldown and reward.
- Basic Supapi Credit earn/spend integration.

### Phase 2 (Progression)
- Multi-pet support per user.
- Evolution paths and level scaling.
- Achievement badges and streak multipliers.

### Phase 3 (Economy Expansion)
- Inventory and item rarity tiers.
- Marketplace (pet/item trade in credits).
- Leaderboards and seasonal events.

