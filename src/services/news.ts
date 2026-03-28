/**
 * Perplexity API News Service
 * Fetches daily agricultural news based on user's state
 */

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  fullContent: string;
  source: string;
  category: 'agriculture' | 'weather' | 'market' | 'policy' | 'technology';
  region: string;
  publishedAt: string;
  relevanceScore: number;
}

const PERPLEXITY_API_KEY = process.env.EXPO_PUBLIC_PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

const extractFirstJsonArray = (text: string): string | null => {
  const start = text.indexOf('[');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '[') {
      depth++;
      continue;
    }

    if (ch === ']') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
};

const extractJsonObjectsFromArrayLike = (text: string): string[] => {
  const objects: string[] = [];

  const start = text.indexOf('[');
  if (start === -1) return objects;

  let inString = false;
  let escaped = false;
  let objDepth = 0;
  let objStart = -1;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      if (objDepth === 0) objStart = i;
      objDepth++;
      continue;
    }

    if (ch === '}') {
      if (objDepth > 0) objDepth--;
      if (objDepth === 0 && objStart !== -1) {
        objects.push(text.slice(objStart, i + 1));
        objStart = -1;
      }
    }
  }

  return objects;
};

/**
 * Fetch agricultural news using Perplexity API
 */
export const fetchAgriculturalNews = async (
  state: string,
  maxArticles: number = 5,
  language: string = 'en'
): Promise<NewsArticle[]> => {
  try {
    if (!PERPLEXITY_API_KEY) {
      console.warn('Perplexity API key not configured. Returning demo news.');
      return getDemoNews(state);
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Map language codes to language names
    const languageMap: { [key: string]: string } = {
      'en': 'English',
      'hi': 'Hindi',
      'bn': 'Bengali'
    };
    const languageName = languageMap[language] || 'English';
    
    const prompt = `Provide exactly ${maxArticles} recent agricultural news items for ${state}, India.

CRITICAL REQUIREMENTS:
- All text MUST be in ${languageName}.
- PRIORITY: items from ${state} first, then other Indian states.
- Output MUST be valid JSON ONLY. No extra text.
- No markdown, no bullet points, no formatting.
- Do NOT include citations/references like [1] or (1).
- Do NOT include any square brackets inside strings.
- fullContent MUST be detailed and comprehensive (approximately 250-300 words), explaining the full story with context, impact, and relevant details.

Return a JSON array (and ONLY the array) in this exact shape (MINIFY JSON, no newlines):
[{"title":"<max 70 chars>","summary":"<max 18 words>","fullContent":"<detailed paragraph, 250-300 words>","source":"<source>","category":"agriculture|weather|market|policy|technology","region":"${state}"}]

The last character of your response must be ]`;

    const response = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 4000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.warn('No content in API response, using demo news');
      return getDemoNews(state);
    }

    // Extract JSON from response (Perplexity sometimes includes markdown formatting)
    let jsonText = content.trim();
    
    // Remove markdown code blocks
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const extracted = extractFirstJsonArray(jsonText);
    if (extracted) {
      jsonText = extracted;
    }

    let articles: any;
    try {
      articles = JSON.parse(jsonText);
    } catch {
      const isTruncated = !content.trimEnd().endsWith(']');
      const objectSnippets = extractJsonObjectsFromArrayLike(jsonText);
      const parsedObjects = objectSnippets
        .map((obj) => {
          try {
            return JSON.parse(obj);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      if (parsedObjects.length > 0) {
        articles = parsedObjects;
      } else {
        console.error('JSON parse error. Response length:', content.length);
        console.error('Is response truncated?', isTruncated);
        console.warn('Could not parse API response, using demo news');
        return getDemoNews(state);
      }
    }

    if (!Array.isArray(articles) || articles.length === 0) {
      console.warn('Invalid or empty articles array, using demo news');
      return getDemoNews(state);
    }

    // Transform and validate articles
    const newsArticles: NewsArticle[] = articles.slice(0, maxArticles).map((article, index) => ({
      id: `news-${Date.now()}-${index}`,
      title: article.title || 'Untitled News',
      summary: article.summary || 'No summary available',
      fullContent: article.fullContent || article.summary || 'No content available',
      source: article.source || 'Agricultural News',
      category: validateCategory(article.category),
      region: article.region || state,
      publishedAt: today,
      relevanceScore: 100 - (index * 10), // Higher score for top results
    }));

    return newsArticles;
  } catch (error: any) {
    console.error('Error fetching agricultural news:', error);
    console.warn('Falling back to demo news due to error:', error?.message);
    return getDemoNews(state);
  }
};

/**
 * Validate category field
 */
const validateCategory = (category: string): NewsArticle['category'] => {
  const validCategories: NewsArticle['category'][] = ['agriculture', 'weather', 'market', 'policy', 'technology'];
  return validCategories.includes(category as any) ? (category as NewsArticle['category']) : 'agriculture';
};

/**
 * Demo news for fallback (when API is unavailable)
 */
const getDemoNews = (state: string): NewsArticle[] => {
  const today = new Date().toISOString().split('T')[0];
  
  return [
    {
      id: 'demo-1',
      title: `${state} Farmers Report Good Monsoon Progress`,
      summary: 'Farmers across the state are reporting favorable monsoon conditions this season. Rainfall distribution has been adequate for major kharif crops.',
      fullContent: `Farmers in ${state} are experiencing one of the better monsoon seasons in recent years. According to the State Agriculture Department, rainfall distribution has been fairly uniform across major agricultural districts, benefiting kharif crops such as rice, cotton, and pulses.\n\nAgricultural experts note that soil moisture levels are adequate, and there's been a significant increase in sowing area compared to last year. The timely arrival of monsoon rains has particularly benefited paddy cultivation in the region.\n\nHowever, authorities are advising farmers to remain vigilant about potential pest infestations that can occur during humid conditions. Regular field monitoring and adopting integrated pest management practices are recommended to protect crops and ensure good yields this season.`,
      source: 'State Agriculture Department',
      category: 'weather',
      region: state,
      publishedAt: today,
      relevanceScore: 100,
    },
    {
      id: 'demo-2',
      title: 'New Government Subsidy Scheme for Organic Farming',
      summary: 'Government announces financial assistance program for farmers transitioning to organic farming methods. Subsidy covers up to 50% of certification costs.',
      fullContent: `The central government has launched a new initiative to encourage farmers to adopt organic farming practices. Under the scheme, farmers will receive financial support covering up to 50% of organic certification costs and assistance for transitioning from conventional to organic methods.\n\nThe program aims to promote sustainable agriculture and reduce dependence on chemical fertilizers and pesticides. Eligible farmers can apply through their local agriculture offices. Priority will be given to small and marginal farmers with landholdings under 5 acres.\n\nOrganic produce typically fetches 20-30% premium prices in the market, making this an attractive option for farmers looking to improve their income. The scheme also includes training programs on organic farming techniques and marketing support for certified organic produce.`,
      source: 'Ministry of Agriculture',
      category: 'policy',
      region: state,
      publishedAt: today,
      relevanceScore: 90,
    },
    {
      id: 'demo-3',
      title: 'Wheat Prices Show Upward Trend in Local Markets',
      summary: 'Market analysts report a 12% increase in wheat prices over the past month due to strong demand and reduced supply from neighboring states.',
      fullContent: `Wheat prices in ${state} markets have witnessed a steady rise over the past month, with rates climbing by approximately 12%. Market analysts attribute this increase to robust demand from flour mills and a decline in arrivals from neighboring states.\n\nThe current wholesale price ranges between ₹2,400-2,600 per quintal in major mandis, compared to ₹2,150-2,300 a month ago. Retail prices have also increased proportionally, affecting household budgets but benefiting farmers with stored produce.\n\nAgricultural market experts suggest that prices may stabilize in the coming weeks as fresh harvest from late-sowing areas begins to arrive. Farmers are advised to time their sales strategically to maximize returns while considering storage costs and quality deterioration factors.`,
      source: 'Agricultural Market Intelligence',
      category: 'market',
      region: state,
      publishedAt: today,
      relevanceScore: 85,
    },
    {
      id: 'demo-4',
      title: 'Drone Technology Revolutionizes Pesticide Application',
      summary: 'Agricultural drones are helping farmers reduce pesticide costs by 30% while improving coverage efficiency and reducing health risks.',
      fullContent: `Agricultural drone technology is making significant inroads in ${state}, offering farmers a more efficient and cost-effective method for pesticide application. These unmanned aerial vehicles can cover large areas quickly, reducing both labor costs and chemical usage.\n\nRecent studies show that drone-based spraying reduces pesticide consumption by 30-40% compared to traditional methods, while providing more uniform coverage. The technology is particularly beneficial for crops like sugarcane, cotton, and orchards where manual spraying is labor-intensive.\n\nSeveral custom hiring centers have begun offering drone spraying services at affordable rates, making the technology accessible to small and medium farmers. The state agriculture department is also providing subsidies for drone purchases under various farmer welfare schemes, encouraging wider adoption of this precision agriculture tool.`,
      source: 'AgriTech News',
      category: 'technology',
      region: state,
      publishedAt: today,
      relevanceScore: 80,
    },
    {
      id: 'demo-5',
      title: 'Integrated Pest Management Workshop for Farmers',
      summary: 'District agriculture office organizing free training on sustainable pest control methods. Registration open for all interested farmers.',
      fullContent: `The district agriculture office is organizing a comprehensive training program on Integrated Pest Management (IPM) techniques for local farmers. The three-day workshop will cover identification of common crop pests, biological control methods, and judicious use of chemical pesticides.\n\nIPM practices help farmers reduce dependency on chemical pesticides while maintaining crop productivity. Participants will learn about beneficial insects, trap crops, and cultural practices that naturally suppress pest populations. The workshop includes both classroom sessions and practical field demonstrations.\n\nRegistration is free and open to all farmers in the district. Participants will receive training materials, demonstration kits, and certificates upon completion. The agriculture department is also offering follow-up support through extension officers to help farmers implement IPM practices in their fields effectively.`,
      source: 'District Agriculture Office',
      category: 'agriculture',
      region: state,
      publishedAt: today,
      relevanceScore: 75,
    },
  ];
};

/**
 * Cache management for news (to avoid excessive API calls)
 */
interface NewsCache {
  state: string;
  articles: NewsArticle[];
  timestamp: number;
}

let newsCache: NewsCache | null = null;
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

const inFlightRequests: Record<string, Promise<NewsArticle[]> | undefined> = {};

/**
 * Get cached news if available and fresh
 */
export const getCachedNews = (state: string): NewsArticle[] | null => {
  if (!newsCache || newsCache.state !== state) {
    return null;
  }

  const now = Date.now();
  if (now - newsCache.timestamp > CACHE_DURATION) {
    return null;
  }

  return newsCache.articles;
};

/**
 * Cache news articles
 */
export const cacheNews = (state: string, articles: NewsArticle[]): void => {
  newsCache = {
    state,
    articles,
    timestamp: Date.now(),
  };
};

/**
 * Fetch news with caching
 */
export const getAgriculturalNews = async (
  state: string,
  maxArticles: number = 5,
  language: string = 'en',
  options?: { forceRefresh?: boolean }
): Promise<NewsArticle[]> => {
  // Cache key includes language
  const cacheKey = `${state}-${language}`;
  const forceRefresh = options?.forceRefresh === true;

  if (!forceRefresh) {
    const cached = getCachedNews(cacheKey);
    if (cached) {
      return cached.slice(0, maxArticles);
    }

    if (inFlightRequests[cacheKey]) {
      const inflight = await inFlightRequests[cacheKey];
      return inflight.slice(0, maxArticles);
    }
  }

  // Fetch fresh news (deduped; forceRefresh overwrites any existing in-flight request)
  inFlightRequests[cacheKey] = fetchAgriculturalNews(state, maxArticles, language)
    .then((articles) => {
      cacheNews(cacheKey, articles);
      return articles;
    })
    .finally(() => {
      delete inFlightRequests[cacheKey];
    });

  const articles = await inFlightRequests[cacheKey];
  return (articles || []).slice(0, maxArticles);
};
