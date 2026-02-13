import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonFab,
  IonFabButton,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  RefresherEventDetail,
} from '@ionic/react';
import { add } from 'ionicons/icons';
import { useAuthContext } from '../contexts/AuthContext';
import { UserRole } from '../types/database';
import {
  getWallPosts,
  deleteWallPost,
  getWallReactions,
  type WallPostWithAuthor,
  type WallGroupedReaction,
} from '../services/wall';
import WallPostCard from '../components/wall/WallPost';
import NewPostModal from '../components/wall/NewPostModal';
import { SkeletonLoader, EmptyStateIllustration } from '../components/common';

const Wall: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuthContext();
  const [posts, setPosts] = useState<WallPostWithAuthor[]>([]);
  const [reactionsByPost, setReactionsByPost] = useState<Map<string, WallGroupedReaction[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const contentRef = useRef<HTMLIonContentElement>(null);

  const isOwner = profile?.role === UserRole.OWNER;

  const loadPosts = useCallback(async (before?: string) => {
    if (!profile?.team_id) return;

    const { posts: data } = await getWallPosts(profile.team_id, 20, before);

    if (before) {
      setPosts((prev) => [...prev, ...data]);
    } else {
      setPosts(data);
    }

    if (data.length < 20) {
      setHasMore(false);
    }

    // Load reactions for these posts
    const postIds = data.map((p) => p.id);
    if (postIds.length > 0) {
      const { reactionsByPost: reactions } = await getWallReactions(postIds);
      if (before) {
        setReactionsByPost((prev) => {
          const merged = new Map(prev);
          reactions.forEach((v, k) => merged.set(k, v));
          return merged;
        });
      } else {
        setReactionsByPost(reactions);
      }
    }

    setIsLoading(false);
  }, [profile?.team_id]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    setHasMore(true);
    await loadPosts();
    event.detail.complete();
  };

  const handleInfinite = async (event: CustomEvent<void>) => {
    if (!hasMore || posts.length === 0) {
      (event.target as HTMLIonInfiniteScrollElement).complete();
      return;
    }

    const lastPost = posts[posts.length - 1];
    await loadPosts(lastPost.created_at);
    (event.target as HTMLIonInfiniteScrollElement).complete();
  };

  const handleDelete = async (postId: string) => {
    await deleteWallPost(postId);
    await loadPosts();
  };

  const handleReactionsChanged = async () => {
    const postIds = posts.map((p) => p.id);
    if (postIds.length > 0) {
      const { reactionsByPost: reactions } = await getWallReactions(postIds);
      setReactionsByPost(reactions);
    }
  };

  // Filter deleted posts for non-owner
  const visiblePosts = isOwner ? posts : posts.filter((p) => !p.deleted_at);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle
            onClick={() => contentRef.current?.scrollToTop(300)}
            style={{ cursor: 'pointer' }}
          >
            {t('wall.title')}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent ref={contentRef} className="ion-padding" fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent
            pullingText={t('refresh.pulling')}
            refreshingSpinner="crescent"
            refreshingText={t('refresh.refreshing')}
          />
        </IonRefresher>

        {isLoading ? (
          <SkeletonLoader variant="chat-list" />
        ) : visiblePosts.length === 0 ? (
          <div className="empty-state">
            <EmptyStateIllustration type="no-posts" />
            <h2>{t('wall.noPosts')}</h2>
            <p>{t('wall.noPostsHint')}</p>
          </div>
        ) : (
          visiblePosts.map((post) => (
            <WallPostCard
              key={post.id}
              post={post}
              reactions={reactionsByPost.get(post.id) || []}
              onDelete={handleDelete}
              onReactionsChanged={handleReactionsChanged}
            />
          ))
        )}

        <IonInfiniteScroll
          onIonInfinite={handleInfinite}
          threshold="200px"
          disabled={!hasMore}
        >
          <IonInfiniteScrollContent loadingSpinner="crescent" />
        </IonInfiniteScroll>

        <IonFab vertical="bottom" horizontal="end" slot="fixed" className="safe-fab">
          <IonFabButton onClick={() => setShowNewPost(true)} className="new-post-fab">
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>

        <style>{`
          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 3rem;
            height: calc(100% - 100px);
          }

          .empty-state h2 {
            margin: 0 0 0.5rem 0;
            font-size: 1.25rem;
            color: hsl(var(--foreground));
          }

          .empty-state p {
            margin: 0;
            color: hsl(var(--muted-foreground));
          }

          .new-post-fab {
            --background: hsl(var(--primary));
            --color: hsl(var(--primary-foreground));
            --box-shadow: 0 4px 16px hsl(var(--primary) / 0.4);
          }

          .safe-fab {
            bottom: calc(16px + env(safe-area-inset-bottom, 0px));
          }
        `}</style>
      </IonContent>

      <NewPostModal
        isOpen={showNewPost}
        onClose={() => setShowNewPost(false)}
        onPostCreated={() => loadPosts()}
      />
    </IonPage>
  );
};

export default Wall;
