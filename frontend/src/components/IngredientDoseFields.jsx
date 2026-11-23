import { formatOriginalDose } from '../prescriptionUtils'

export default function IngredientDoseFields({ herb, onChange }) {
  return (
    <div style={{ flex: 2, minWidth: 0 }}>
      <label style={{ display: 'block' }}>원본 참고량
        <input aria-label="원본 용량" value={formatOriginalDose(herb)} readOnly
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px' }} />
      </label>
      {herb.amount != null && herb.originalDoseInfo && (
        <p style={{ whiteSpace: 'pre-wrap' }}>원문 메모: {herb.originalDoseInfo}</p>
      )}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
        <label>실제 처방량 (선택)
          <input aria-label="실제 처방량" inputMode="decimal" value={herb.prescribedAmount ?? ''}
            onChange={(event) => onChange('prescribedAmount', event.target.value)}
            style={{ width: '110px', display: 'block', padding: '8px' }} />
        </label>
        <label>실제 처방 단위
          <input aria-label="실제 처방 단위" placeholder="단위 입력" value={herb.prescribedUnit ?? ''}
            onChange={(event) => onChange('prescribedUnit', event.target.value)}
            style={{ width: '100px', display: 'block', padding: '8px' }} />
        </label>
      </div>
    </div>
  )
}
