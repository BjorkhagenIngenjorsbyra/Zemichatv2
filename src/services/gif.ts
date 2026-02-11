/**
 * GIF search service using Giphy API.
 * Requires VITE_GIPHY_API_KEY in environment.
 */

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || '';

if (!GIPHY_API_KEY) {
  console.warn('[Zemichat] VITE_GIPHY_API_KEY is not set. GIF search will not work.');
}

const GIPHY_BASE_URL = 'https://api.giphy.com/v1/gifs';

export interface GifResult {
  id: string;
  title: string;
  previewUrl: string; // Small preview
  url: string; // Full size gif
  width: number;
  height: number;
}

interface GiphyImage {
  url: string;
  width: string;
  height: string;
}

interface GiphyItem {
  id: string;
  title: string;
  images: {
    original: GiphyImage;
    fixed_width: GiphyImage;
    fixed_width_small: GiphyImage;
    preview_gif: GiphyImage;
  };
}

function mapGiphyItem(item: GiphyItem): GifResult {
  const original = item.images.original;
  // Use fixed_width (200px) for sharper previews instead of fixed_width_small (100px)
  const preview = item.images.fixed_width || item.images.fixed_width_small || item.images.preview_gif;

  return {
    id: item.id,
    title: item.title || '',
    previewUrl: preview?.url || original?.url || '',
    url: original?.url || '',
    width: parseInt(original?.width, 10) || 200,
    height: parseInt(original?.height, 10) || 200,
  };
}

/**
 * Search for GIFs on Giphy.
 */
export async function searchGifs(
  query: string,
  limit = 20,
  lang = 'en'
): Promise<{ gifs: GifResult[]; error: Error | null }> {
  try {
    if (!GIPHY_API_KEY) {
      return { gifs: [], error: new Error('GIPHY API key not configured') };
    }

    const params = new URLSearchParams({
      api_key: GIPHY_API_KEY,
      q: query,
      limit: String(limit),
      lang,
      rating: 'pg',
    });

    const response = await fetch(`${GIPHY_BASE_URL}/search?${params}`);

    if (!response.ok) {
      return { gifs: [], error: new Error(`Giphy API error: ${response.status}`) };
    }

    const data = await response.json();
    const gifs: GifResult[] = (data.data || []).map((item: GiphyItem) => mapGiphyItem(item));

    return { gifs, error: null };
  } catch (err) {
    return {
      gifs: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}

/**
 * Get trending GIFs from Giphy.
 */
export async function getTrendingGifs(
  limit = 20,
  _lang = 'en'
): Promise<{ gifs: GifResult[]; error: Error | null }> {
  try {
    if (!GIPHY_API_KEY) {
      return { gifs: [], error: new Error('GIPHY API key not configured') };
    }

    const params = new URLSearchParams({
      api_key: GIPHY_API_KEY,
      limit: String(limit),
      rating: 'pg',
    });

    const response = await fetch(`${GIPHY_BASE_URL}/trending?${params}`);

    if (!response.ok) {
      return { gifs: [], error: new Error(`Giphy API error: ${response.status}`) };
    }

    const data = await response.json();
    const gifs: GifResult[] = (data.data || []).map((item: GiphyItem) => mapGiphyItem(item));

    return { gifs, error: null };
  } catch (err) {
    return {
      gifs: [],
      error: err instanceof Error ? err : new Error('Unknown error'),
    };
  }
}
