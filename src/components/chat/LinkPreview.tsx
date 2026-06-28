import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';

interface LinkPreviewData {
  title: string;
  description: string;
  imageUrl: string | null;
  domain: string;
}

interface LinkPreviewProps {
  url: string;
  isOwn: boolean;
}

// In-memory cache keyed by URL. Stores the in-flight PROMISE (not the resolved
// value) so that when several messages with the same re-shared link mount at
// once, they share a single edge-function call instead of each firing one.
const previewCache = new Map<string, Promise<LinkPreviewData | null>>();

function loadPreview(url: string): Promise<LinkPreviewData | null> {
  const cached = previewCache.get(url);
  if (cached) return cached;

  const promise = (async (): Promise<LinkPreviewData | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-link-preview', {
        body: { url },
      });
      if (error || !data) return null;
      return data as LinkPreviewData;
    } catch {
      return null;
    }
  })();

  previewCache.set(url, promise);
  return promise;
}

const LinkPreview: React.FC<LinkPreviewProps> = ({ url, isOwn }) => {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    loadPreview(url).then((data) => {
      if (!cancelled) {
        setPreview(data);
        setIsLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [url]);

  if (isLoading || !preview) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`link-preview ${isOwn ? 'own' : 'other'}`}
    >
      {preview.imageUrl && /^https:\/\//i.test(preview.imageUrl) && (
        <img
          src={preview.imageUrl}
          alt=""
          className="link-preview-image"
          loading="lazy"
        />
      )}
      <div className="link-preview-text">
        <span className="link-preview-domain">{preview.domain}</span>
        {preview.title && <span className="link-preview-title">{preview.title}</span>}
        {preview.description && (
          <span className="link-preview-desc">{preview.description}</span>
        )}
      </div>

      <style>{`
        .link-preview {
          display: block;
          text-decoration: none;
          color: inherit;
          margin-top: 0.5rem;
          border-radius: 0.75rem;
          overflow: hidden;
          border: 1px solid hsl(var(--border) / 0.5);
        }

        .link-preview.own {
          background: hsl(var(--primary-foreground) / 0.1);
        }

        .link-preview.other {
          background: hsl(var(--muted) / 0.2);
        }

        .link-preview-image {
          width: 100%;
          max-height: 140px;
          object-fit: cover;
          display: block;
        }

        .link-preview-text {
          padding: 0.5rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .link-preview-domain {
          font-size: 0.7rem;
          text-transform: uppercase;
          opacity: 0.8;
          letter-spacing: 0.03em;
        }

        .link-preview-title {
          font-size: 0.8rem;
          font-weight: 600;
          line-height: 1.2;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .link-preview-desc {
          font-size: 0.75rem;
          opacity: 0.8;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </a>
  );
};

export default LinkPreview;

/**
 * Extract the first URL from a text string.
 */
export function extractUrl(text: string): string | null {
  const urlRegex = /https?:\/\/[^\s<>'"]+/i;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
}
