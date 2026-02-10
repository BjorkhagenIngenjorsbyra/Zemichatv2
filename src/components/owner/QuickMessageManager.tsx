import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonInput,
  IonSpinner,
  IonAlert,
  IonReorder,
  IonReorderGroup,
  ItemReorderEventDetail,
} from '@ionic/react';
import { addOutline, createOutline, trashOutline, reorderThreeOutline } from 'ionicons/icons';
import {
  getQuickMessagesForUser,
  createQuickMessage,
  updateQuickMessage,
  deleteQuickMessage,
  reorderQuickMessages,
} from '../../services/quickMessage';
import { type QuickMessage } from '../../types/database';

interface QuickMessageManagerProps {
  userId: string;
}

/**
 * Manager component for owners to CRUD quick messages for a Texter.
 */
export const QuickMessageManager: React.FC<QuickMessageManagerProps> = ({
  userId,
}) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuickMessage | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadMessages = useCallback(async () => {
    const { messages: quickMsgs } = await getQuickMessagesForUser(userId);
    setMessages(quickMsgs);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleAdd = async () => {
    if (!newMessage.trim() || isSaving) return;

    setIsSaving(true);
    const { message, error } = await createQuickMessage(userId, newMessage);

    if (!error && message) {
      setMessages((prev) => [...prev, message]);
      setNewMessage('');
      setIsAdding(false);
    }

    setIsSaving(false);
  };

  const handleStartEdit = (msg: QuickMessage) => {
    setEditingId(msg.id);
    setEditValue(msg.content);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editValue.trim() || isSaving) return;

    setIsSaving(true);
    const { error } = await updateQuickMessage(editingId, editValue);

    if (!error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editingId ? { ...m, content: editValue.trim() } : m
        )
      );
    }

    setEditingId(null);
    setEditValue('');
    setIsSaving(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsSaving(true);
    const { error } = await deleteQuickMessage(deleteTarget.id);

    if (!error) {
      setMessages((prev) => prev.filter((m) => m.id !== deleteTarget.id));
    }

    setDeleteTarget(null);
    setIsSaving(false);
  };

  const handleReorder = async (event: CustomEvent<ItemReorderEventDetail>) => {
    const { from, to } = event.detail;

    // Reorder locally first
    const reordered = [...messages];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setMessages(reordered);

    // Complete the reorder animation
    event.detail.complete();

    // Save to database
    const ids = reordered.map((m) => m.id);
    await reorderQuickMessages(ids);
  };

  return (
    <div className="quick-message-manager">
      <div className="manager-header">
        <h3 className="section-title">{t('quickMessages.title')}</h3>
        {!isAdding && (
          <IonButton
            fill="clear"
            size="small"
            onClick={() => setIsAdding(true)}
          >
            <IonIcon icon={addOutline} slot="start" />
            {t('quickMessages.add')}
          </IonButton>
        )}
      </div>

      {isAdding && (
        <div className="add-message-form">
          <IonInput
            value={newMessage}
            onIonInput={(e) => setNewMessage(e.detail.value || '')}
            placeholder={t('quickMessages.placeholder')}
            className="message-input"
          />
          <div className="form-actions">
            <IonButton
              fill="outline"
              size="small"
              onClick={() => {
                setIsAdding(false);
                setNewMessage('');
              }}
            >
              {t('common.cancel')}
            </IonButton>
            <IonButton
              fill="solid"
              size="small"
              onClick={handleAdd}
              disabled={!newMessage.trim() || isSaving}
            >
              {isSaving ? <IonSpinner name="crescent" /> : t('common.save')}
            </IonButton>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="loading-state">
          <IonSpinner name="crescent" />
        </div>
      ) : messages.length === 0 ? (
        <div className="empty-state">
          <p>{t('quickMessages.noMessages')}</p>
          <p className="hint">{t('quickMessages.noMessagesDescription')}</p>
        </div>
      ) : (
        <IonList className="message-list">
          <IonReorderGroup
            disabled={!!editingId}
            onIonItemReorder={handleReorder}
          >
            {messages.map((msg) => (
              <IonItem key={msg.id} className="message-item">
                <IonReorder slot="start">
                  <IonIcon icon={reorderThreeOutline} />
                </IonReorder>

                {editingId === msg.id ? (
                  <div className="edit-form">
                    <IonInput
                      value={editValue}
                      onIonInput={(e) => setEditValue(e.detail.value || '')}
                      className="edit-input"
                    />
                    <div className="edit-actions">
                      <IonButton
                        fill="clear"
                        size="small"
                        onClick={handleCancelEdit}
                      >
                        {t('common.cancel')}
                      </IonButton>
                      <IonButton
                        fill="solid"
                        size="small"
                        onClick={handleSaveEdit}
                        disabled={!editValue.trim() || isSaving}
                      >
                        {isSaving ? (
                          <IonSpinner name="crescent" />
                        ) : (
                          t('common.save')
                        )}
                      </IonButton>
                    </div>
                  </div>
                ) : (
                  <>
                    <IonLabel>{msg.content}</IonLabel>
                    <IonButton
                      fill="clear"
                      slot="end"
                      onClick={() => handleStartEdit(msg)}
                    >
                      <IonIcon icon={createOutline} slot="icon-only" />
                    </IonButton>
                    <IonButton
                      fill="clear"
                      color="danger"
                      slot="end"
                      onClick={() => setDeleteTarget(msg)}
                    >
                      <IonIcon icon={trashOutline} slot="icon-only" />
                    </IonButton>
                  </>
                )}
              </IonItem>
            ))}
          </IonReorderGroup>
        </IonList>
      )}

      <IonAlert
        isOpen={!!deleteTarget}
        onDidDismiss={() => setDeleteTarget(null)}
        header={t('common.delete')}
        message={t('quickMessages.deleteConfirm')}
        buttons={[
          {
            text: t('common.cancel'),
            role: 'cancel',
          },
          {
            text: t('common.delete'),
            role: 'destructive',
            handler: handleDelete,
          },
        ]}
      />

      <style>{`
        .quick-message-manager {
          margin-bottom: 1rem;
        }

        .manager-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .section-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #e5e7eb;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0;
        }

        .add-message-form {
          background: hsl(var(--card));
          border-radius: 1rem;
          padding: 1rem;
          margin-bottom: 0.75rem;
        }

        .message-input,
        .edit-input {
          --background: hsl(var(--background));
          --border-radius: 0.5rem;
          --padding-start: 0.75rem;
          --padding-end: 0.75rem;
          border: 1px solid hsl(var(--border));
          border-radius: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .form-actions,
        .edit-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
        }

        .loading-state {
          display: flex;
          justify-content: center;
          padding: 2rem;
        }

        .empty-state {
          text-align: center;
          padding: 1.5rem;
          background: hsl(var(--card));
          border-radius: 1rem;
        }

        .empty-state p {
          margin: 0;
          color: #9ca3af;
        }

        .empty-state .hint {
          font-size: 0.85rem;
          margin-top: 0.25rem;
        }

        .message-list {
          background: hsl(var(--card));
          border-radius: 1rem;
          overflow: hidden;
          padding: 0;
        }

        .message-item {
          --background: transparent;
          --border-color: hsl(var(--border));
          --padding-start: 0.5rem;
          --color: #d1d5db;
        }

        .edit-form {
          flex: 1;
          padding: 0.5rem 0;
        }

        ion-reorder {
          cursor: grab;
        }
      `}</style>
    </div>
  );
};

export default QuickMessageManager;
