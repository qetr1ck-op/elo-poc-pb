import React from 'react'
import classNames from 'classnames';

interface TextNode {
  type: "text-node"
  className: "text-node"
  id: string
  text: string
  settings: {
    type: 'text-settings'
    list: {
      size: "font-size-sm" | "font-size-md" | "font-size-lg"
      weight: "font-weight-sm" | "font-weight-md" | "font-weight-lg"
    }
  }
}

interface SidebarNode {
  type: "sidebar-node"
  className: "sidebar-node"
  text: "Sidebar"
  id: string
  settings: {
    type: 'sidebar-settings'
    list: Record<string, string>[]
  }
}

interface ImageNode {
  type: "image-node"
    className: "image-node"
    text: "Image"
    id: string
    settings: {
      type: "image-settings"
    }
  }

type Node = TextNode | SidebarNode | ImageNode

interface Col {
  type: "col-node"
  className: "col-node"
  text: "col"
  id: string
  children: Record<string, Node>[]
}

interface Row {
  type: "row-node"
  className: "row-node"
  text: "row"
  id: string
  children: Record<string, Col>[]
}

interface Nodes {
  type: "root-node"
  className: "root-node"
  text: "root"
  id: "root"
  children: Record<string, Row>[]
}

export const Viewer = ({ nodes }: { nodes: Nodes }) => {
  return (
    <div className='root'>
      {Object.values(nodes.children).map((row: Row) => (
        <div className={row.className} key={row.id}>
          {Object.values(row.children).map((col: Col) => (
            <div className={classNames(col.className)} key={col.id}>
              {Object.values(col.children).map((node, index) => {
                if (node.type === 'text-node') {
                  return (
                    <div
                      key={index}
                      className={node.className}
                      style={{
                        background: node.settings.palette.background,
                        borderRadius: node.settings.styling.radius,
                      }}
                    >
                      <div
                        className={`text-value`}
                        style={{
                          fontSize: node.settings.styling.fontSize,
                          fontWeight: node.settings.styling.weight,
                          lineHeight: node.settings.styling.spacing,
                          color: node.settings.palette.text,
                        }}
                      >
                        {node.text}
                      </div>
                    </div>
                  )
                } else if (node.type === 'sidebar-node') {
                  return (
                    <ul
                      key={index}
                      className='sidebar-node'
                      style={{
                        backgroundColor: node.settings.palette.brand,
                      }}
                    >
                      {node.settings.list.map(({name, id}, index: number) => {
                        return(
                        <li
                          key={index}
                          className={`sidebar-node-item`}
                        >
                          <a
                            href={`/?id=${id}`}
                            style={{
                              color: node.settings.palette.onBrand,
                            }}
                          >
                            {name}
                          </a>
                        </li>
                      )})}
                    </ul>
                  )
                } else if (node.type === 'image-node') {
                  return (
                    <div
                      key={index}
                      className={node.className}
                    >
                      <div className={`image-value`}>
                        <img src={node.settings.src} />
                      </div>
                    </div>
                  )
                }
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
