import { useEffect, useState } from 'react'

export const RadioSwitch = ({ label, options, value, onChange }) => {
    const [curentValue, setValue] = useState(value)
    useEffect(() => {
      onChange(curentValue)
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
          {options.map((item, index) => (
            <span
              key={index}
                className={`switch-value${curentValue === item.value ? ' active' : ''}`}
                onClick={() => {
                setValue(item.value)
                }}
            >
                {item.label}
            </span>
            ))}
        </div>
      </div>
    )
  }