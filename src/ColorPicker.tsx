import { useEffect, useState } from 'react'

export const ColorPicker = ({ label, value, onChange }) => {
    const [curentValuem, setValue] = useState(value)
    useEffect(() => {
      if (value && value !== curentValuem) {
        onChange(curentValuem)
      }
    }, [curentValuem])

    return (
      <div className='switch'>
        <div className='switch-label'>{label}</div>
        <div className='switch-values'>
          <input
            type="color"
            value={curentValuem}
            onChange={(e) => {
              setValue(e.target.value)
            }}
          />
        </div>
      </div>
    )
  }