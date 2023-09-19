import { useEffect, useState } from 'react'

export const ColorPicker = ({ label, value, onChange }) => {
    const [curentValue, setValue] = useState(value)
    useEffect(() => {
      if (value && value !== curentValue) {
        onChange(curentValue)
      }
    }, [curentValue])
    useEffect(() => {
      if (value !== curentValue) {
        setValue(value)
      }
    }, [value])
    return (
      <div className='switch'>
        <div className='switch-label'>{label}</div>
        <div className='switch-values'>
          <input
            type="color"
            value={curentValue}
            onChange={(e) => {
              setValue(e.target.value)
            }}
          />
        </div>
      </div>
    )
  }