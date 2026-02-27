# Edge Functions – Deployment Notes

## 401 Invalid JWT Fix

If you see `401 Invalid JWT` or `FunctionsHttpError` when the app invokes notification functions, the function is rejecting the request due to JWT verification.

### Option A: Deploy via CLI (recommended)

`supabase/config.toml` already sets `verify_jwt = false` for the notification functions. Deploy with:

```bash
supabase functions deploy notify-priest-new-booking
supabase functions deploy notify-priest-cancellation
supabase functions deploy notify-parishioner-cancellation
```

### Option B: Supabase Dashboard

If you deploy or edit functions via the Dashboard:

1. Go to **Edge Functions** → select the function
2. Open **Function settings**
3. Turn off **Enforce JWT verification** (or equivalent)

### Required secrets

In **Project Settings** → **Edge Functions** → **Secrets**:

- `RESEND_API_KEY` – from resend.com
- `RESEND_FROM_EMAIL` – verified sender email
