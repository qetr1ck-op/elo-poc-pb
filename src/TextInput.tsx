import { useEffect, useState } from 'react'

export const TextInput = ({label, value, onChange, disabled}) => {
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
    <div className='text-input-wrapper'>
      {label}
      <input
        type='text'
        className='text-input'
        value={curentValue}
        onChange={(e) => { setValue(e.target.value) }}
        disabled={disabled}
      />
    </div>
  )
}