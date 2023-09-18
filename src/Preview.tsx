import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'

import { Viewer } from './Viewer'
import './index.css'

export default function App() {
  const [rootEl, setRootEl] = useState(null)

  useEffect(() => {
    if (window.location.search === '') {
      window.location.search = `?id=root`
    }
    const queryId = window.location.search && window.location.search.split('=')[1]
    const data = localStorage.getItem('canvas');
    const parsedData = JSON.parse(data)
    const page = parsedData[queryId]
    setRootEl(page)
  }, [])

  return (
    rootEl &&
    <div className="App">
      <Viewer nodes={rootEl} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)