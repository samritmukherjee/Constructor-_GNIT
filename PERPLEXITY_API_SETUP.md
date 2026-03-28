# 🗞️ Perplexity API Setup for Agricultural News

## Overview
The app now fetches real-time agricultural news using the Perplexity AI API, providing farmers with daily updates relevant to their location.

---

## ✅ Features
- **Daily agricultural news** based on farmer's state/region
- **5 categories**: Agriculture, Weather, Market, Policy, Technology
- **Smart caching** (6 hours) to minimize API calls
- **Fallback demo news** if API is unavailable
- **Beautiful modal** for reading full articles
- **Auto-refresh** daily for latest updates

---

## 🔑 Step 1: Get Perplexity API Key

1. **Sign up for Perplexity**
   - Go to [https://www.perplexity.ai/](https://www.perplexity.ai/)
   - Click "Sign Up" and create an account

2. **Get API Access**
   - Go to [https://www.perplexity.ai/settings/api](https://www.perplexity.ai/settings/api)
   - Or navigate: Settings → API
   - Click "Generate API Key"
   - Copy your API key (it will look like: `pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

3. **Pricing** (as of 2024)
   - Free tier: $5 credit (~1000 requests)
   - Pay-as-you-go: ~$0.005 per request
   - Each news fetch = 1 API call
   - With 6-hour caching, typical usage: ~4 calls/day per user

---

## 🔧 Step 2: Add API Key to Your App

1. **Open your `.env` file** (create one if it doesn't exist in project root)

2. **Add this line:**
   ```bash
   EXPO_PUBLIC_PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. **Replace** `pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` with your actual API key from Step 1

4. **Restart Expo** (IMPORTANT):
   ```bash
   npx expo start --clear
   ```
   The `--clear` flag ensures the new environment variable is loaded.

---

## 📱 How It Works

### News Fetching Flow
1. **On Dashboard Load:**
   - App checks cache (valid for 6 hours)
   - If cache is fresh → show cached news
   - If cache is stale/empty → fetch from Perplexity API

2. **API Request:**
   - Sends farmer's state/region to Perplexity
   - Requests 5 latest agricultural news articles
   - Categories: agriculture, weather, market, policy, technology

3. **Response Processing:**
   - Parses JSON response from Perplexity
   - Formats articles with title, summary, full content
   - Caches results for 6 hours
   - Displays in beautiful cards

4. **Fallback:**
   - If API fails or key is missing → shows demo news
   - Demo news is hardcoded but still relevant to farming

### User Experience
- **Preview Cards:** Show title, summary, category, region
- **Tap to Read:** Opens beautiful full article modal
- **Categories:** Color-coded badges (weather=blue, market=green, etc.)
- **Region Tags:** Shows relevant location for each news item
- **Source Attribution:** Displays news source in full article

---

## 🧪 Testing

### Test 1: With API Key (Real News)
1. Add API key to `.env`
2. Restart: `npx expo start --clear`
3. Open app → Navigate to Dashboard
4. Wait 2-3 seconds for news to load
5. **Expected:** 5 agricultural news articles appear
6. Tap any article → Full article modal opens

### Test 2: Without API Key (Demo News)
1. Remove API key from `.env` or set it to empty string
2. Restart: `npx expo start --clear`
3. Open app → Navigate to Dashboard
4. **Expected:** 5 demo news articles appear (fallback)
5. Tap any article → Full article modal opens

### Test 3: Cache Validation
1. With API key, open dashboard (triggers fetch)
2. Close and reopen app within 6 hours
3. **Expected:** News loads instantly from cache
4. Wait >6 hours or clear app data
5. **Expected:** Fresh fetch from API

---

## 🐛 Troubleshooting

### News Shows "Loading..." Forever
- **Check:** Is your API key correct in `.env`?
- **Check:** Did you restart Expo with `--clear` flag?
- **Check:** Console logs for errors (Metro bundler)
- **Solution:** Verify API key, restart Expo

### Getting Demo News Instead of Real News
- **Cause:** API key not found or invalid
- **Check:** `.env` file has `EXPO_PUBLIC_PERPLEXITY_API_KEY=pplx-...`
- **Check:** Key starts with `pplx-`
- **Solution:** Copy-paste key correctly, restart Expo

### API Request Failed (429 Error)
- **Cause:** Rate limit exceeded (too many requests)
- **Solution:** Wait 1 minute, then retry
- **Prevention:** App caches for 6 hours to minimize calls

### API Request Failed (401 Error)
- **Cause:** Invalid or expired API key
- **Solution:** Generate new API key from Perplexity dashboard
- **Update:** Replace old key in `.env`, restart Expo

### News Not Relevant to My Location
- **Current:** App uses "India" as default location
- **Future Enhancement:** 
  - Fetch user's state from profile (Firestore `users/{uid}` collection)
  - Pass actual state to `getAgriculturalNews(userState, 5)`
  - Requires user profile to have `state` field

---

## 📊 API Usage Optimization

### Current Optimizations
✅ **6-hour cache** → Max 4 API calls per user per day  
✅ **Lazy loading** → Only fetch when dashboard opens  
✅ **Fallback demo news** → No API calls if key missing  
✅ **Single request** → Fetches all 5 articles at once  

### Cost Estimation
- **Per user per day:** ~4 API calls (~$0.02)
- **100 users per day:** 400 calls (~$2.00)
- **1000 users per day:** 4000 calls (~$20.00)

### Future Enhancements
- [ ] Pull-to-refresh to manually fetch latest news
- [ ] Save favorite articles to Firestore
- [ ] Share articles with other farmers
- [ ] Filter news by category (weather, market, etc.)
- [ ] Push notifications for breaking agricultural news
- [ ] User-specific state/district targeting

---

## 🚀 Quick Setup Checklist

- [ ] Sign up for Perplexity AI account
- [ ] Generate API key from Settings → API
- [ ] Add `EXPO_PUBLIC_PERPLEXITY_API_KEY=pplx-xxx` to `.env`
- [ ] Restart Expo with `npx expo start --clear`
- [ ] Open Dashboard → Verify news loads
- [ ] Tap article → Verify modal opens with full content
- [ ] Test fallback by removing API key temporarily

**Your agricultural news feed is now live!** 🎉

---

## 📝 Code Reference

### Files Modified/Created
- ✅ `src/services/news.ts` - Perplexity API integration
- ✅ `src/screens/DashboardScreen.tsx` - Dynamic news display
- ✅ `.env` - API key configuration (user must add)

### Key Functions
- `fetchAgriculturalNews(state, maxArticles)` - Calls Perplexity API
- `getAgriculturalNews(state, maxArticles)` - Fetch with caching
- `getDemoNews(state)` - Fallback demo news
- `getCategoryIcon(category)` - Visual category badges
- `getCategoryColor(category)` - Color-coded cards

---

## 💡 Pro Tips

1. **Don't commit your API key** to Git
   - Add `.env` to `.gitignore`
   - Use environment variables for production

2. **Monitor API usage**
   - Check Perplexity dashboard for usage stats
   - Set up billing alerts

3. **Test with demo news first**
   - Works without API key
   - Verify UI/UX before adding real API

4. **Cache is stored in memory**
   - Clearing app data resets cache
   - Cache survives app backgrounding but not force-close

5. **Customize for your region**
   - Edit `getDemoNews()` for region-specific fallback
   - Update state detection logic for better targeting

---

Need help? Check console logs for detailed error messages! 🔍
