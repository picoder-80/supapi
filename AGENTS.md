# Supapi — AGENTS.md

## Project Overview
Supapi is a Pi Network ecosystem platform built with Next.js 15 and TypeScript, deployed on Vercel. It integrates with the Pi SDK for authentication and payments, and uses Supabase for data management.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Ecosystem**: Pi Network (Pi SDK, Pi Browser)
- **Repo**: github.com/picoder-80/supapi

## Project Structure
- `/app` — Next.js App Router pages and layouts
- `/components` — Reusable UI components
- `/lib` — Utilities, Supabase client, Pi SDK helpers
- `sdk.ts` — Pi SDK configuration and scopes

## Key Platforms inside Supapi
- Supamarket, Supaspace, Supacrow, Supasifieds, Supaauto, Supabulk

## Database Tables (Supabase)
- `seller_earnings`, `seller_withdrawals`, `admin_revenue` — commission/escrow system
- Auth via Pi SDK `authenticate()` — wallet_address from Pi SDK

## Theme & Design
- Hero gradient: 135deg #1A1A2E → #0F3460
- Body bg: #F8F9FD, Surface: white, Border: #E2E8F0
- Text dark: #1A1A2E, Muted: #718096, Gold accent: #F5A623
- Cards: white bg, border-radius 16px, hover = gold border + lift
- Primary button: gold, TopBar: sticky 60px, BottomNav: fixed

## Coding Conventions
- Always use TypeScript strict types — no `any`
- Supabase responses must always handle null checks
- Pi SDK calls must include readiness guard before execution
- Use `--font-sans` CSS variable for all fonts (no hardcoded Google Fonts)
- All pages must follow universal theme including admin and dashboard

## Agent Instructions
- Always check existing types before creating new ones
- Prefer server components unless client interactivity needed
- Handle Pi Browser payment failures gracefully with proper timeout
- When fixing build errors, check `dashboard/page.tsx` patterns first
- Supabase wallet verification uses `wallet_address` from `authenticate()` — no micro-transactions