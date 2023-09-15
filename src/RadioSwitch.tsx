import { useEffect, useState } from 'react'

export const RadioSwitch = ({ label, options, value, onChange }) => {
    const [curentValuem, setValue] = useState(value)
    useEffect(() => {
      onChange(curentValuem)
    }, [curentValuem])

    return (
      <div className='switch'>
        <div className='switch-label'>{label}</div>
        <div className='switch-values'>
          {options.map((item, index) => (
            <span
              key={index}
                className={`switch-value${curentValuem === item.value ? ' active' : ''}`}
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