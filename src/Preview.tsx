import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import classNames from 'classnames';
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
      <div className='root'>
        {Object.values(rootEl.children).map((row, index) => {
          return( 
            <div className={row.className} key={row.id}>
              {Object.values(row.children).map((col) => (
                <div className={classNames(col.className)} key={col.id}>
                  {Object.values(col.children).map((node, index) => {
                    if (node.type === 'text-node') {
                      return (
                        <div className={node.className} key={node.id}>
                          <div className={`text-value ${Object.values(node.settings.list).join(' ')}`}>
                            {node.text}
                          </div>
                        </div>
                      )
                    } else if (node.type === 'sidebar-node') {
                      return (
                        <ul className='sidebar-node' key={index}>
                          {node.settings.list.map(({name, id}, index: number) => {
                            return(
                            <li
                              key={index}
                              className={`sidebar-node-item`}
                            >
                              <a href={`/?id=${id}`}>{name}</a>
                            </li>
                          )})}
                        </ul>
                      )
                    } else if (node.type === 'image-node') {
                      return (
                        <div className={node.className} key={index}>
                        <div className={`image-value`}>
                          <img src={node.settings.list.src} />
                        </div>
                      </div>
                      )
                    }
                  })}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)