'use client';

import { useState } from 'react';

interface RiskWarningProps {
  currentHF: number;
  newHF: number;
  onProceed: () => void;
  onCancel: () => void;
}

export default function RiskWarning({ currentHF, newHF, onProceed, onCancel }: RiskWarningProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const getRiskLevel = (hf: number): 'low' | 'moderate' | 'high' | 'critical' => {
    if (hf < 1.0) return 'critical';
    if (hf < 1.2) return 'high';
    if (hf < 1.5) return 'moderate';
    return 'low';
  };

  const riskLevel = getRiskLevel(newHF);

  // Don't show warning for low risk
  if (riskLevel === 'low') return null;

  const getRiskConfig = () => {
    switch (riskLevel) {
      case 'critical':
        return {
          title: 'Critical Risk - Action Blocked!',
          emoji: '⛔',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-300',
          textColor: 'text-red-800',
          buttonColor: 'bg-red-600 hover:bg-red-700',
          message: (
            <>
              This action would make your position <strong>liquidatable</strong> with a Health
              Factor below 1.0 ({newHF.toFixed(2)}). Your collateral will be at{' '}
              <strong>immediate risk of seizure</strong> by liquidators.
            </>
          ),
          recommendations: [
            'Deposit more collateral before borrowing',
            'Reduce the borrow amount',
            'Repay existing debt to improve your health factor',
          ],
          allowProceed: false,
        };

      case 'high':
        return {
          title: 'High Risk Warning',
          emoji: '🚨',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-300',
          textColor: 'text-orange-800',
          buttonColor: 'bg-orange-600 hover:bg-orange-700',
          message: (
            <>
              This action will reduce your health factor to <strong>{newHF.toFixed(2)}</strong>,
              putting your position at <strong>high risk of liquidation</strong>. Even a small
              price movement could trigger liquidation.
            </>
          ),
          recommendations: [
            'Maintain a health factor above 1.5 for safety',
            'Consider depositing more collateral',
            'Monitor your position closely if you proceed',
          ],
          allowProceed: true,
        };

      case 'moderate':
        return {
          title: 'Moderate Risk - Proceed with Caution',
          emoji: '⚠️',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-300',
          textColor: 'text-yellow-800',
          buttonColor: 'bg-yellow-600 hover:bg-yellow-700',
          message: (
            <>
              This action will reduce your health factor to <strong>{newHF.toFixed(2)}</strong>.
              While not immediately dangerous, this leaves less margin for price fluctuations.
            </>
          ),
          recommendations: [
            'A health factor above 1.5 is recommended for safety',
            'Be prepared to add collateral if prices move against you',
            'Monitor your position regularly',
          ],
          allowProceed: true,
        };

      default:
        return null;
    }
  };

  const config = getRiskConfig();
  if (!config) return null;

  return (
    <div
      className={`border rounded-lg p-5 ${config.bgColor} ${config.borderColor} mt-4 animate-in fade-in slide-in-from-top-2 duration-200`}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl flex-shrink-0">{config.emoji}</span>
        <div className="flex-1">
          <h4 className={`font-bold text-lg mb-2 ${config.textColor}`}>{config.title}</h4>
          <p className={`text-sm mb-3 ${config.textColor}`}>{config.message}</p>

          {/* Risk Details */}
          <div className="bg-white bg-opacity-60 rounded-lg p-3 mb-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-600">Current HF:</span>
                <span className="font-semibold ml-2">
                  {currentHF === Infinity ? '∞' : currentHF.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">New HF:</span>
                <span className={`font-semibold ml-2 ${config.textColor}`}>
                  {newHF.toFixed(2)} <span className="text-red-600">↓</span>
                </span>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="mb-4">
            <p className={`text-sm font-semibold mb-2 ${config.textColor}`}>Recommendations:</p>
            <ul className={`text-sm ${config.textColor} space-y-1 ml-4`}>
              {config.recommendations.map((rec, idx) => (
                <li key={idx} className="list-disc">
                  {rec}
                </li>
              ))}
            </ul>
          </div>

          {/* Acknowledgment checkbox for risky actions */}
          {config.allowProceed && riskLevel !== 'moderate' && (
            <label className="flex items-start gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <span className={`text-sm ${config.textColor}`}>
                I understand the risks and want to proceed anyway
              </span>
            </label>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {config.allowProceed ? (
              <>
                <button
                  onClick={onCancel}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex-1"
                >
                  Cancel (Recommended)
                </button>
                <button
                  onClick={onProceed}
                  disabled={riskLevel !== 'moderate' && !acknowledged}
                  className={`px-4 py-2 ${config.buttonColor} text-white rounded-lg transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium flex-1`}
                >
                  {riskLevel === 'moderate' ? 'Proceed with Caution' : 'I Accept the Risk'}
                </button>
              </>
            ) : (
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium w-full"
              >
                Go Back
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline risk indicator (for display without blocking)
 */
export function RiskIndicator({ healthFactor }: { healthFactor: number }) {
  if (healthFactor >= 1.5) {
    return (
      <div className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
        <span>🟢</span>
        <span>Safe</span>
      </div>
    );
  }

  if (healthFactor >= 1.2) {
    return (
      <div className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
        <span>🟡</span>
        <span>Moderate Risk</span>
      </div>
    );
  }

  if (healthFactor >= 1.0) {
    return (
      <div className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded">
        <span>🟠</span>
        <span>High Risk</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-1 rounded">
      <span>🔴</span>
      <span>Liquidatable</span>
    </div>
  );
}
