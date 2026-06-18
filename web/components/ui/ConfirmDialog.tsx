'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirming?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirming = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const resolvedConfirm = confirmLabel ?? t('common.confirm');
  const resolvedCancel = cancelLabel ?? t('common.cancel');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirming) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, confirming, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="confirm-overlay"
      role="presentation"
      onClick={() => {
        if (!confirming) onClose();
      }}
    >
      <div
        className="confirm-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="confirm-title">
          {title}
        </h2>
        <p id="confirm-message" className="confirm-message">
          {message}
        </p>
        <div className="confirm-actions">
          <button type="button" className="confirm-cancel" onClick={onClose} disabled={confirming}>
            {resolvedCancel}
          </button>
          <button type="button" className="confirm-confirm" onClick={onConfirm} disabled={confirming}>
            {confirming ? t('common.processing') : resolvedConfirm}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
