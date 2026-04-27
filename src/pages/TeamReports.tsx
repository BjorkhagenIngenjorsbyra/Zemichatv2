import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSegment,
  IonSegmentButton,
  IonRefresher,
  IonRefresherContent,
  IonModal,
  IonButton,
  IonText,
  IonNote,
  IonIcon,
  type RefresherEventDetail,
} from '@ionic/react';
import { flagOutline, mailOutline } from 'ionicons/icons';
import {
  getTeamReports,
  setReportStatus,
  type ReportWithReporter,
} from '../services/report';
import {
  ReportStatus,
  ReportCategory,
  UserRole,
} from '../types/database';
import { useAuthContext } from '../contexts/AuthContext';
import { Redirect } from 'react-router-dom';

type StatusFilter = 'all' | 'pending' | 'escalated';

const TeamReports: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuthContext();

  const [reports, setReports] = useState<ReportWithReporter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<ReportCategory | 'all'>(
    'all',
  );
  const [selected, setSelected] = useState<ReportWithReporter | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const opts: Parameters<typeof getTeamReports>[0] = {};
    if (statusFilter !== 'all') {
      opts.status =
        statusFilter === 'pending'
          ? ReportStatus.PENDING
          : ReportStatus.ESCALATED;
    }
    if (categoryFilter !== 'all') opts.category = categoryFilter;
    const { reports: rows } = await getTeamReports(opts);
    setReports(rows);
    setIsLoading(false);
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Owner-only page. If a non-owner somehow lands here, kick them
  // back to the dashboard rather than rendering an empty list.
  if (profile && profile.role !== UserRole.OWNER) {
    return <Redirect to="/dashboard" />;
  }

  const handleRefresh = async (e: CustomEvent<RefresherEventDetail>) => {
    await load();
    e.detail.complete();
  };

  const setStatus = async (
    report: ReportWithReporter,
    status:
      | ReportStatus.REVIEWED
      | ReportStatus.RESOLVED
      | ReportStatus.DISMISSED,
  ) => {
    await setReportStatus(report.id, status);
    setSelected(null);
    await load();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" />
          </IonButtons>
          <IonTitle>{t('report.team.title')}</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSegment
            value={statusFilter}
            onIonChange={(e) =>
              setStatusFilter((e.detail.value as StatusFilter) ?? 'all')
            }
          >
            <IonSegmentButton value="all">
              <IonLabel>{t('report.team.filterAll')}</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="pending">
              <IonLabel>{t('report.team.filterPending')}</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="escalated">
              <IonLabel>{t('report.team.filterEscalated')}</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: '0.5rem 1rem' }}>
          <select
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(
                (e.target.value as ReportCategory | 'all') ?? 'all',
              )
            }
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--ion-color-medium)',
              background: 'transparent',
              color: 'var(--ion-text-color)',
            }}
          >
            <option value="all">{t('report.team.category')}: {t('report.team.filterAll')}</option>
            {Object.values(ReportCategory).map((c) => (
              <option key={c} value={c}>
                {t(`report.categories.${c}`)}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? null : reports.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <IonIcon
              icon={flagOutline}
              style={{ fontSize: '3rem', color: 'var(--ion-color-medium)' }}
            />
            <p>{t('report.team.empty')}</p>
          </div>
        ) : (
          <IonList>
            {reports.map((r) => (
              <IonItem key={r.id} button onClick={() => setSelected(r)}>
                <IonLabel>
                  <h3>
                    {r.category
                      ? t(`report.categories.${r.category}`)
                      : t('report.categories.other')}
                  </h3>
                  <p>
                    {r.target_type ? `${r.target_type}` : ''}
                    {r.reporter?.display_name
                      ? ` · ${r.reporter.display_name}`
                      : ''}
                  </p>
                  <IonNote color="medium">
                    {new Date(r.created_at).toLocaleString()}
                  </IonNote>
                </IonLabel>
                <IonBadge
                  slot="end"
                  color={
                    r.status === ReportStatus.ESCALATED
                      ? 'danger'
                      : r.status === ReportStatus.PENDING
                        ? 'warning'
                        : 'medium'
                  }
                >
                  {t(`report.status.${r.status}`)}
                </IonBadge>
              </IonItem>
            ))}
          </IonList>
        )}

        <IonModal isOpen={!!selected} onDidDismiss={() => setSelected(null)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>{t('report.title')}</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setSelected(null)}>
                  {t('report.cancel')}
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            {selected && (
              <>
                <p>
                  <strong>{t('report.team.reporter')}:</strong>{' '}
                  {selected.reporter?.display_name ||
                    selected.reporter?.zemi_number ||
                    selected.reporter_id}
                </p>
                <p>
                  <strong>{t('report.team.target')}:</strong>{' '}
                  {selected.target_type ?? 'unknown'}{' '}
                  {selected.reported_user?.display_name
                    ? `(${selected.reported_user.display_name})`
                    : ''}
                </p>
                <p>
                  <strong>{t('report.team.category')}:</strong>{' '}
                  {selected.category
                    ? t(`report.categories.${selected.category}`)
                    : '-'}
                </p>
                <p>
                  <strong>{t('report.team.status')}:</strong>{' '}
                  {t(`report.status.${selected.status}`)}
                </p>
                {selected.description && (
                  <>
                    <p>
                      <strong>{t('report.team.description')}:</strong>
                    </p>
                    <IonText>
                      <p style={{ whiteSpace: 'pre-wrap' }}>
                        {selected.description}
                      </p>
                    </IonText>
                  </>
                )}

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    marginTop: '1.5rem',
                  }}
                >
                  <IonButton
                    expand="block"
                    fill="outline"
                    href="mailto:support@zemichat.com?subject=Zemichat%20moderation"
                  >
                    <IonIcon slot="start" icon={mailOutline} />
                    {t('report.team.openSupport')}
                  </IonButton>

                  {selected.status !== ReportStatus.REVIEWED && (
                    <IonButton
                      expand="block"
                      onClick={() => setStatus(selected, ReportStatus.REVIEWED)}
                    >
                      {t('report.team.markReviewed')}
                    </IonButton>
                  )}
                  {selected.status !== ReportStatus.RESOLVED && (
                    <IonButton
                      expand="block"
                      color="success"
                      onClick={() => setStatus(selected, ReportStatus.RESOLVED)}
                    >
                      {t('report.team.markResolved')}
                    </IonButton>
                  )}
                  {selected.status !== ReportStatus.DISMISSED && (
                    <IonButton
                      expand="block"
                      color="medium"
                      onClick={() =>
                        setStatus(selected, ReportStatus.DISMISSED)
                      }
                    >
                      {t('report.team.markDismissed')}
                    </IonButton>
                  )}
                </div>
              </>
            )}
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default TeamReports;
