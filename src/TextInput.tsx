import { useEffect, useState } from 'react'

export const TextInput = ({label, value, onChange}) => {
    const [curentValue, setValue] = useState(value)
    useEffect(() => {
      onChange(curentValue)
    }, [curentValue])
  return (
    <div>
        {label} <input type='text' value={curentValue} onChange={(e) => { setValue(e.target.value) }}/>
    </div>
  )
}