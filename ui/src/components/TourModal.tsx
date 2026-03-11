import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tourSteps } from '../utils/featureTourData';
import './TourModal.css';

interface TourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestSettingsMenu?: (open: boolean) => void;
  stepIndex?: number;
  onStepIndexChange?: React.Dispatch<React.SetStateAction<number>>;
}

const TourModal: React.FC<TourModalProps> = ({ isOpen, onClose, onRequestSettingsMenu, stepIndex, onStepIndexChange }) => {
  const [targetRects, setTargetRects] = useState<any[]>([]);
  const [anchorRect, setAnchorRect] = useState<any>(null);
  const [tooltipStyle, setTooltipStyle] = useState<any>({});
  const [tooltipPlacement, setTooltipPlacement] = useState('center');
  const tooltipRef = useRef<any>(null);
  const prevIsOpenRef = useRef(isOpen);
  const navigate = useNavigate();
  const location = useLocation();

  // Only close the settings menu when the tour *transitions* from open to closed,
  // not on every render when the tour is closed (which was closing the dropdown on open).
  useEffect(() => {
    if (prevIsOpenRef.current && !isOpen && onRequestSettingsMenu) {
      onRequestSettingsMenu(false);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, onRequestSettingsMenu]);

  const totalSteps = tourSteps.length;
  const safeStepIndex = Math.max(0, Math.min(stepIndex ?? 0, totalSteps - 1));
  const step: any = tourSteps[safeStepIndex] || {
    title: 'Tour',
    description: 'Tour steps are loading. Please try again.',
    targetIds: [],
    route: undefined,
    dashboardView: undefined,
    cashFlowView: undefined,
    customChartView: undefined,
  };
  const isFirstStep = safeStepIndex === 0;
  const isLastStep = safeStepIndex === totalSteps - 1;

  const updateTargets = useCallback(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    if (!step?.targetIds?.length) {
      setTargetRects([]);
      setAnchorRect(null);
      return;
    }

    const elements = step.targetIds
      .map((targetId: any) => document.querySelector(`[data-tour-id="${targetId}"]`))
      .filter(Boolean);

    if (!elements.length) {
      setTargetRects([]);
      setAnchorRect(null);
      return;
    }

    try {
      elements[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch (error: any) {
      // Ignore scroll failures (e.g., unsupported environments).
    }

    const rects = elements.map((element: any) => element.getBoundingClientRect());
    setTargetRects(rects);
    setAnchorRect(rects[0]);
  }, [step]);

  useEffect(() => {
    if (!isOpen) return;

    const needsSettingsMenu = step?.targetIds?.some((targetId: any) =>
      targetId.startsWith('settings-')
    );
    if (onRequestSettingsMenu) {
      onRequestSettingsMenu(needsSettingsMenu);
    }
  }, [isOpen, step, onRequestSettingsMenu]);

  useEffect(() => {
    if (!isOpen) return;
    if (!step?.route && !step?.dashboardView) {
      return;
    }

    const targetPath = step.route || '/app';
    const nextState = step.dashboardView
      ? {
          dashboardView: step.dashboardView,
          cashFlowView: step.cashFlowView ?? null,
          customChartView: step.customChartView,
          selectedChartId: null as any,
          chartToViewId: null as any
        }
      : undefined;

    if (location.pathname !== targetPath || step.dashboardView) {
      navigate(targetPath, { state: nextState, replace: true });
    }
  }, [isOpen, step, navigate, location.pathname]);

  useEffect(() => {
    if (!isOpen) return;
    updateTargets();

    const handleUpdate = () => updateTargets();
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isOpen, updateTargets]);

  useEffect(() => {
    if (!isOpen) return;
    const retryTimer = setTimeout(() => {
      updateTargets();
    }, 80);
    return () => clearTimeout(retryTimer);
  }, [isOpen, safeStepIndex, updateTargets]);

  const measureTooltipPosition = useCallback(() => {
    if (!isOpen) return false;
    if (!anchorRect) {
      setTooltipStyle({});
      setTooltipPlacement('center');
      return true;
    }
    if (!tooltipRef.current) {
      return false;
    }

    const padding = 16;
    const spacing = 14;
    const tooltipWidth = tooltipRef.current.offsetWidth || 320;
    const tooltipHeight = tooltipRef.current.offsetHeight || 140;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let placement = 'right';
    let left = anchorRect.right + spacing;
    let top = anchorRect.top + anchorRect.height / 2 - tooltipHeight / 2;

    if (left + tooltipWidth > viewportWidth - padding) {
      left = anchorRect.left - spacing - tooltipWidth;
      placement = 'left';
    }

    if (left < padding) {
      left = anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2;
      placement = 'bottom';
      top = anchorRect.bottom + spacing;
    }

    if (top + tooltipHeight > viewportHeight - padding) {
      if (placement === 'bottom') {
        top = anchorRect.top - spacing - tooltipHeight;
        placement = 'top';
      } else {
        top = viewportHeight - tooltipHeight - padding;
      }
    }

    if (top < padding) {
      top = padding;
    }

    setTooltipPlacement(placement);
    setTooltipStyle({
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`
    });
    return true;
  }, [anchorRect, isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const measured = measureTooltipPosition();
    if (measured) return;
    const frame = window.requestAnimationFrame(() => {
      measureTooltipPosition();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, safeStepIndex, measureTooltipPosition]);

  const handleNext = () => {
    if (isLastStep) {
      onClose();
      return;
    }
    onStepIndexChange?.((prev: any) => prev + 1);
  };

  const handleBack = () => {
    if (!isFirstStep) {
      onStepIndexChange?.((prev: any) => prev - 1);
    }
  };

  const resolvedTooltipStyle = anchorRect && Object.keys(tooltipStyle).length
    ? tooltipStyle
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  if (!isOpen) return null;

  return (
    <div className="tour-modal-overlay" onClick={onClose}>
      {targetRects.map((rect: any, index: any) => (
        <div
          key={`${rect.left}-${rect.top}-${index}`}
          className="tour-highlight"
          style={{
            top: `${Math.max(rect.top - 6, 0)}px`,
            left: `${Math.max(rect.left - 6, 0)}px`,
            width: `${Math.max(rect.width + 12, 0)}px`,
            height: `${Math.max(rect.height + 12, 0)}px`
          }}
        />
      ))}
      <div
        ref={tooltipRef}
        className={`tour-tooltip ${anchorRect ? 'tour-tooltip--anchored' : ''}`}
        data-placement={tooltipPlacement}
        style={resolvedTooltipStyle}
        onClick={(e: any) => e.stopPropagation()}
      >
        <div className="tour-tooltip-header">
          <div>
            <div className="tour-step-indicator">
              Step {safeStepIndex + 1}/{totalSteps}
            </div>
            <h3>{step.title}</h3>
          </div>
          <button className="tour-modal-close" onClick={onClose} aria-label="Close tour">
            ×
          </button>
        </div>
        <div className="tour-modal-body">
          <p>{step.description}</p>
        </div>
        <div className="tour-modal-actions">
          <button
            className="tour-button tour-button-secondary"
            onClick={handleBack}
            disabled={isFirstStep}
            type="button"
          >
            Back
          </button>
          <button
            className="tour-button tour-button-primary"
            onClick={handleNext}
            type="button"
          >
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TourModal;
