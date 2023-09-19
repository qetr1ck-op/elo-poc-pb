import React, { useEffect, useState } from 'react';
import { renderToString } from 'react-dom/server';

import './index.css';

import { makeAutoObservable, toJS } from 'mobx';
import { observer } from 'mobx-react-lite';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import classNames from 'classnames';
import { RadioSwitch } from './RadioSwitch'
import { ColorPicker } from './ColorPicker'
import { TextInput } from './TextInput'
import { Viewer } from './Viewer';
// ---

const genUUID = (): string => crypto.randomUUID();

function arrayMove(arr, oldIndex, newIndex) {
  if (newIndex >= arr.length) {
      let k = newIndex - arr.length + 1;
      while (k--) {
          arr.push(undefined);
      }
  }
  arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0]);
  return arr;
};

const arrayInsert = (arr, index, newItem) => [
  ...arr.slice(0, index),
  newItem,
  ...arr.slice(index)
]

// ---
type ColorPalette = {
  brand: string
  accent: string
  text: string
  background: string
  onBrand: string
}
type Styling = {
  fontSize: string
  weight: string
  spacing: string
  radius: string
  shadow: string
}
interface GlobalStyling {
  palette: ColorPalette
  styling: Styling
}
type ElementType = 'row' | 'text' | 'sidebar' | 'image';
interface Element {
  type: ElementType;
  text: string;
}

class RowElement implements Element {
  type: ElementType = 'row';
  cols: number;
  text: string;

  constructor(options: { cols: number; text: string }) {
    this.cols = options.cols;
    this.text = options.text;
  }
}

class TextElement implements Element {
  type: ElementType = 'text';
  text: string;

  constructor(options: { text: string }) {
    this.text = options.text;
  }
}

interface ImageSettings {
  type: 'image-settings'
  list: {
    src: string
    opacity: number
  }
}

class ImageElement implements Element {
  type: ElementType = 'image';
  text: string;

  constructor(options: { text: string, settings?: ImageSettings }) {
    this.text = options.text;
  }
}

type SidebarSettings = {name: string, id: string}[]

const defaultSidebarSettings: SidebarSettings = [
  { name: 'first', id: 'root', },
  { name: 'second', id: 'root2', }
]

class SidebarElement implements Element {
  type: ElementType = 'sidebar';
  text: string;
  settings: SidebarSettings

  constructor(options: { text: string, settings?: SidebarSettings }) {
    this.text = options.text;

    if (options?.settings){
      this.settings = options.settings
    } else {
      this.settings = defaultSidebarSettings
    }

  }
}

class ElementsStore {
  constructor() {
    makeAutoObservable(this);
  }

  elements: Element[] = [];
  selectedElement: Element | TextElement | null = null

  register(elements: Element[]) {
    this.elements = elements;
  }
}

const elementsStore = new ElementsStore();

// ---

interface Node {
  id: string;
  // TODO: type
  type: string;
  className: string;
  text: string;
  // TODO: list?
  children: Record<string, Node>;
  parent: Node | null;
}

class RootNode implements Node {
  id: string = 'root';
  type = 'root-node';
  className = 'root-node';
  text = 'root';
  children: Record<string, RowNode> = {};
  parent = null;
  globalSettings: GlobalStyling = {
     palette: {
      brand: '#0361F0',
      accent:  '#F2F5F8',
      text:  '#000000',
      background:  '#FFFFFF',
      onBrand:  '#FFFFFF',
    },
    styling: {
      fontSize:  '16px',
      weight:  '500',
      spacing:  '1.5',
      radius:  '10px',
      shadow:  'none',
    },
  }

  constructor(id?: string) {
    makeAutoObservable(this);
    if (id) {
      this.id = id
    }
  }
}

class RowNode implements Node {
  id = genUUID();
  type = 'row-node';
  className = 'row-node';
  text = 'row';
  children: Record<string, ColNode> = {};
  parent: RootNode;

  constructor(options: { cols?: number; node?: RowNode; parentNode: RootNode }) {
    makeAutoObservable(this);
    this.parent = options.parentNode;
    const isNewNode = !options.node;

    if (isNewNode) {
      this.create(options.cols);
    } else {
      this.update(options.node as RowNode);
    }
  }

  private update(row: RowNode) {
    this.id = row.id;
    this.text = row.text;

    const map: Record<string, ColNode> = {};
    this.children = Object.values(row.children)
      .map((node) => new ColNode(node, this))
      .reduce((acc, el) => {
        acc[el.id] = el;
        return acc;
      }, map);
  }

  private create(cols = 1) {
    const map: Record<string, ColNode> = {};

    this.children = new Array(cols)
      .fill(null)
      .map(() => new ColNode(null, this))
      .reduce((acc, el) => {
        acc[el.id] = el;
        return acc;
      }, map);
  }
}

class ColNode implements Node {
  id = genUUID();
  type = 'col-node';
  className = 'col-node';
  text = 'col';
  children: Record<string, Node> = {};
  parent: Node;

  constructor(node: ColNode | null, parentNode: RowNode) {
    makeAutoObservable(this);

    this.parent = parentNode;
    if (node) {
      this.update(node);
    }
  }

  private update(node: ColNode) {
    this.id = node.id;
    this.text = node.text;

    const map: Record<string, Node> = {};
    this.children = Object.values(node.children)
      .map((node) => {
        // TODO: Node.type guards
        if (node instanceof TextNode || node.type === "text-node") {
          return new TextNode(node as TextNode, this);
        } else if (node instanceof SidebarNode || node.type === "sidebar-node"){
          return new SidebarNode(node as SidebarNode, this);
        } else if (node instanceof ImageNode || node.type === "image-node"){
          return new ImageNode(node as ImageNode, this);
        }
        return node;
      })
      .reduce((acc, el) => {
        acc[el.id] = el;
        return acc;
      }, map);
  }
}

class TextNode implements Node {
  id = genUUID();
  type = 'text-node';
  className = 'text-node';
  text: string;
  children: Record<string, Node> = {};
  parent: Node;
  localSettings: Partial<GlobalStyling> = {
    palette: {},
    styling: {},
  }

  constructor(node: TextNode | TextElement, parentNode: Node) {
    makeAutoObservable(this)
    this.text = node.text;
    this.parent = parentNode;

    if(node?.localSettings){
      this.localSettings = node.localSettings
    }
  }

  get settings() {
    // TODO: how to access to globalSettings
    return {
      palette: {
        ...canvasStore.nodes.globalSettings?.palette,
        ...this.localSettings.palette,
      },
      styling: {
        ...canvasStore.nodes.globalSettings.styling,
        ...this.localSettings.styling,
      }
    }
  }
}

class ImageNode implements Node {
  id = genUUID();
  type = 'image-node';
  className = 'image-node';
  text: string;
  children: Record<string, Node> = {};
  parent: Node;
  localSettings: Partial<GlobalStyling> = {
    palette: {},
    styling: {},
    src: 'http://localhost:5173/image.jpg',
  }

  constructor(node: ImageElement, parentNode: Node) {
    makeAutoObservable(this)
    this.text = node.text;
    this.parent = parentNode;

    if(node?.localSettings){
      this.localSettings = node.localSettings
    }
  }

  get settings() {
    return {
      palette: {
        ...canvasStore.nodes.globalSettings?.palette,
        ...this.localSettings.palette,
      },
      styling: {
        ...canvasStore.nodes.globalSettings.styling,
        ...this.localSettings.styling,
      },
      src: this.localSettings.src,
    }
  }
}

class SidebarNode implements Node {
  id = genUUID();
  type = 'sidebar-node';
  className = 'sidebar-node';
  text: string;
  children: Record<string, Node> = {};
  parent: Node;
  localSettings: Partial<GlobalStyling> = {
    palette: {},
    styling: {},
    list: defaultSidebarSettings,
  }
  constructor(node: SidebarNode, parentNode: Node) {
    makeAutoObservable(this)
    this.text = node.text;
    this.parent = parentNode;
    if(node?.localSettings){
      this.localSettings = node.localSettings
    }
  }

  get settings() {
    return {
      palette: {
        ...canvasStore.nodes.globalSettings?.palette,
        ...this.localSettings.palette,
      },
      styling: {
        ...canvasStore.nodes.globalSettings.styling,
        ...this.localSettings.styling,
      },
      list: this.localSettings.list
    }
  }
}

interface Adapter {
  save(rootNode: RootNode, id: string): void;
  load(id: string): RootNode | null;
  clear(id: string): void;
}

class LocalStorageAdapter implements Adapter {
  save(rootNode: RootNode, id: string) {
    const data = localStorage.getItem('canvas');
    let newData
    if (data) {
      const parsedData = JSON.parse(data)
      newData = { ...parsedData, [id]: rootNode }
    } else {
      newData = { [id]: rootNode }
    }

    localStorage.setItem('canvas', JSON.stringify(newData));
  }

  load(id: string): RootNode | null {
    const data = localStorage.getItem('canvas');

    if (data) {
      const parsedData = JSON.parse(data)
      return parsedData[id];
    }
    return null;
  }

  clear(id: string) {
    const data = localStorage.getItem('canvas');
    if (data) {
      const parsedData = JSON.parse(data)
      delete parsedData[id]
      localStorage.setItem('canvas', JSON.stringify({ ...parsedData }));
    }
  }
}

class CanvasStore {
  nodes; //
  queryId: string;
  selectedNode: Node | null = null;
  selectedRowNode: Node | null = null;

  saveAdapters: Adapter[] = [];
  loadAdapters: Adapter[] = [];

  constructor() {
    makeAutoObservable(this);
    this.queryId = window.location.search && window.location.search.split('=')[1]
    this.nodes = new RootNode(this.queryId)
    this.registerAdapters();

    this.load();
  }

  setSelectedNode(node: Node) {
    this.selectedNode = node;
  }

  setSelectedRowNode(node: Node) {
    this.selectedRowNode = node;
  }

  addRowNode(elem: RowElement, index) {
    const arr = Object.values(this.nodes.children)
    const newArr = arrayInsert(arr, index, new RowNode({ cols: elem.cols, parentNode: this.nodes }))
    this.nodes.children = Object.values(newArr)
      .map((node) => new RowNode({ node, parentNode: this.nodes }))
      .reduce((acc, el) => {
        acc[el.id] = el;
        return acc;
      }, {});
  }

  moveRowNode(elem: RowElement, targetIndex: number) {
    const arr = Object.values(this.nodes.children)
    const oldIndex = arr.findIndex((i) => i.id === elem.id)

    let newArr
    if (oldIndex > targetIndex) {
      newArr = arrayMove(arr, oldIndex, targetIndex)
    } else {
      newArr = arrayMove(arr, oldIndex, targetIndex - 1)
    }

    this.nodes.children = Object.values(newArr)
      .map((node) => new RowNode({ node, parentNode: this.nodes }))
      .reduce((acc, el) => {
        acc[el.id] = el;
        return acc;
      }, {});

  }

  removeNode(node: Node) {
    if (!node.parent) {
      throw new Error(`No parent node - ${node}`);
    }
    delete node.parent.children[node.id];
  }

  addNode(node: Node | Element, parenNode: Node) {
    // TODO: Node.type guards, strategy pattern
    // move
    if (node instanceof TextNode || node instanceof SidebarNode || node instanceof ImageNode) {
      delete node.parent.children[node.id];
      parenNode.children[node.id] = node;
      node.parent = parenNode;
    }

    // create
    if (node instanceof TextElement) {
      const textNode = new TextNode(node, parenNode);
      parenNode.children[textNode.id] = textNode;
    } else if (node instanceof SidebarElement) {
      const sidebarNode = new SidebarNode(node, parenNode);
      parenNode.children[sidebarNode.id] = sidebarNode;
    } else if (node instanceof ImageElement) {
      const imageNode = new ImageNode(node, parenNode);
      parenNode.children[imageNode.id] = imageNode;
    }
  }

  updateNodeSettings (part: string, key: string, value: string) {
    if (this.selectedNode) {
      this.selectedNode.localSettings[part][key] = value
    }
  }
  updateGlobalSettings (part: string, key: string, value: string) {
    this.nodes.globalSettings[part][key] = value
  }
  updateNodeText (val: string){
    this.selectedNode.text = val
  }

  registerAdapters() {
    const localStorageAdapter = new LocalStorageAdapter();

    this.saveAdapters.push(localStorageAdapter);
    this.loadAdapters.push(localStorageAdapter);
  }

  // Function to recursively set parentNode to null
  private removeParentNode(node: Node) {
    // Set the parentNode of the current node to null
    node.parent = null;

    for (const key in node.children) {
      if (node.children[key]) {
        this.removeParentNode(node.children[key]);
      }
    }

    return node;
  }

  // plain structure without mobx/circular refs
  private getPlainNodes() {
    const nodes = toJS(this.nodes);

    return this.removeParentNode({ ...nodes, children: { ...this.nodes.children } }) as RootNode;
  }

  save() {
    this.saveAdapters.forEach((adapter) => {
      adapter.save(this.getPlainNodes(), this.queryId);
    });
  }

  clear() {
    this.saveAdapters.forEach((adapter) => {
      adapter.clear(this.queryId);
    });
    this.nodes = new RootNode(genUUID());
  }

  load() {
    this.loadAdapters.forEach((adapter) => {
      const data = adapter.load(this.queryId);

      if (!data) {
        return;
      }

      const map: Record<string, RowNode> = {};
      this.nodes.globalSettings = data.globalSettings
      this.nodes.children = Object.values(data.children)
        .map((node) => new RowNode({ node, parentNode: this.nodes }))
        .reduce((acc, el) => {
          acc[el.id] = el;
          return acc;
        }, map);
    });
  }

  isPreviewOpened = false
  html: string = ''
  css: string = ''
  view: 'mobile' | 'laptop' = 'laptop'

  upadatePreview () {
    const html = renderToString(
      <Viewer nodes={this.nodes} />
    )
    this.html = html
    const css = document.getElementsByTagName('style')[0].innerHTML;
    this.css = css
  }

  preview () {
    this.upadatePreview()
    this.isPreviewOpened = !this.isPreviewOpened
  }
  setView (v) {
    this.view = v
  }
  isTemplatesModalOpen = false
  toggleTemplates(val){
    this.isTemplatesModalOpen = val
  }


  saveAsTemplate (id){
      const data = localStorage.getItem('templates');

      let newData

      if (data) {
        const parsedData = JSON.parse(data)
        newData = { ...parsedData, [id]: this.getPlainNodes() }
      } else {
        newData = { [id]: this.getPlainNodes() }
      }

      localStorage.setItem('templates', JSON.stringify(newData));
  }

  loadTemplate(id: string) {
      const data = localStorage.getItem('templates');

      const parsedData = JSON.parse(data)
        const nodes = parsedData[id];
        this.nodes.globalSettings = nodes.globalSettings
        this.nodes.children = Object.values(nodes.children)
      .map((node) => new RowNode({ node, parentNode: this.nodes }))
      .reduce((acc, el) => {
        acc[el.id] = el;
        return acc;
      }, {});

      this.toggleTemplates(false)

    }
}

const canvasStore = new CanvasStore();

// ----

interface Props {
  children: React.ReactNode;
}

const Builder: React.FC<Props> = observer(({ children }) => {
  return <div className="builder">{children}</div>;
});

const TextNodeRenderer: React.FC<{
  node: TextNode;
  canvasStore: CanvasStore,
  elementsStore:ElementsStore,
  }> = observer(({ node, canvasStore }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
      type: 'text',
      item: node,
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }));
    return (
      <div
        onClick={(e) => {
          canvasStore.setSelectedNode(node)
        }}
        className={node.className}
        ref={drag}
        style={{
          background: node.settings.palette.background,
          borderRadius: node.settings.styling.radius,
          opacity: isDragging ? 0.7 : 1
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
        <NodeControls onRemove={() => canvasStore.removeNode(node)} />
      </div>
    );
  }
);

const ImageNodeRenderer: React.FC<{
  node: ImageNode;
  canvasStore: CanvasStore,
  }> = observer(({ node, canvasStore }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
      type: 'text',
      item: node,
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }));

    return (
      <div
        onClick={(e) => {
          canvasStore.setSelectedNode(node)
        }}
        className={node.className}
        ref={drag}
      >
        <div className={`image-value`}>
          <img src={node.settings.src} />
        </div>
        <NodeControls onRemove={() => canvasStore.removeNode(node)} />
      </div>
    );
  }
);
const SidebarRenderer = observer(({ node, canvasStore}: {node: SidebarNode, canvasStore: CanvasStore}) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'text',
    item: node,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <ul
      className='sidebar-node'
      ref={drag}
      style={{
        scale: isDragging ? 1 : 0.8,
        backgroundColor: node.settings.palette.brand,
      }}
      onClick={(e) => {
        canvasStore.setSelectedNode(node)
      }}
    >
      <NodeControls onRemove={() => canvasStore.removeNode(node)} />
      {node.settings.list.map(({name, id}, index: number) => {
        return(
        <li
          key={index}
          onClick={() => {
            // canvasStore.setActiveCanvas()
          }}
          className={`sidebar-node-item ${canvasStore.nodes.id === id ? 'active' : ''}`}
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
})

const ColNodeRenderer: React.FC<{ node: ColNode; canvasStore: CanvasStore, elementsStore: ElementsStore }> = observer(
  ({ node: col, canvasStore }) => {
    const [{ isOver }, drop] = useDrop(
      () => ({
        accept: ['text', 'sidebar', 'image'],
        drop: (item: Node | Element) => {
          canvasStore.addNode(item, col);
        },
        collect: (monitor) => ({
          isOver: !!monitor.isOver(),
        }),
      })
      // [x, y] deps!
    );

    return (
      <div
        className={classNames(col.className, {
          '--is-over': isOver,
        })}
        ref={drop}
      >
        {Object.values(col.children).map((node, index) => {
          // TODO: strategy
          if (node instanceof TextNode) {
            return <TextNodeRenderer index={index} key={node.id} node={node} elementsStore={elementsStore} canvasStore={canvasStore} />;
          } else if (node instanceof SidebarNode) {
            return <SidebarRenderer key={node.id} node={node} canvasStore={canvasStore} />;
          } else if (node instanceof ImageNode) {
            return <ImageNodeRenderer key={node.id} node={node} canvasStore={canvasStore} />;
          }
        })}
      </div>
    );
  }
);

const NodeControls: React.FC<{ onRemove: () => void }> = observer(({ onRemove }) => {
  return (
    <div className="controls">
      <div onClick={onRemove}>❌</div>
    </div>
  );
});

const DropArea = ({index, className}: {index: number, className?: string}) => {
  const [{ isOver }, drop] = useDrop(() => ({
      accept: 'row',
      drop: (item: RowElement) => {

        if (item.id) {
          canvasStore.moveRowNode(item, index);
        } else {
          canvasStore.addRowNode(item, index);
        }
      },

      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    }))
  return (
    <div className={`drop-area ${isOver ? 'drop-area--is-over' : '' } ${className}`} ref={drop}/>
  )
}


const RowNodeRenderer: React.FC<{
  node: RowNode;
  canvasStore: CanvasStore;
  elementsStore: ElementsStore;
  index: number
}> = observer(({ node, canvasStore, elementsStore, index }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'row',
    item: node,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <div
      className={node.className}
      onClick={(e) => {
        canvasStore.setSelectedRowNode(node)

        if (e.target.className === 'row-node') {
          canvasStore.setSelectedNode(null)
        }
      }}
      ref={drag}
      style={{
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <NodeControls onRemove={() => canvasStore.removeNode(node)} />
      <DropArea key={index} index={index} />
      {Object.values(node.children).map((node) => (
        <ColNodeRenderer key={node.id} node={node} canvasStore={canvasStore} elementsStore={elementsStore} />
      ))}
    </div>
  );
});

const IframePreview = observer(({canvasStore}:{canvasStore: CanvasStore}) => (
  <>
  <div>
    <button onClick={() => canvasStore.preview()}>👁️</button>
    <button onClick={() => canvasStore.setView('mobile')}>📱</button>
    <button onClick={() => canvasStore.setView('laptop' )}>💻</button>
  </div>
  <iframe
    style={{ width: canvasStore.view === 'mobile' ? '400px' : '100%' }}
    src={`data:text/html;charset=utf-8,${escape(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>HTML Document</title>
            <style>
            ${canvasStore.css}
            </style>
        </head>
        <body>
            ${canvasStore.html}
        </body>
      </html>
    `)}`}
  ></iframe>
</>
))

const Canvas: React.FC<{ canvasStore: CanvasStore, elementsStore: ElementsStore }> = observer(({ canvasStore, elementsStore }) => {
  const rootEl = canvasStore.nodes;

  if (!rootEl?.children) {
    return null
  }
  const lastIndex = Object.values(rootEl?.children).length

  return (
    <div className="builder__canvas">
      <div>Canvas</div>
      <div className="actions">
        <div className="actions__save" onClick={() => canvasStore.toggleTemplates(true)}>
          📚
        </div>
        <div className="actions__save" onClick={() => canvasStore.preview()}>
          👁️
        </div>
        <div className="actions__save" onClick={() => canvasStore.save()}>
          💾
        </div>
        <div className="actions__clear" onClick={() => canvasStore.clear()}>
          ❌
        </div>
      </div>
      <div className={classNames('root')}>
        {Object.values(rootEl.children).map((node, index) => {
          return <RowNodeRenderer key={`${index}_${node.id}`} index={index} node={node} canvasStore={canvasStore} elementsStore={elementsStore} />
        })}
        <DropArea
          key={lastIndex}
          index={lastIndex}
          className={`root_drop ${lastIndex === 0 ? 'empty' : ''}`}
        />
      </div>
      {canvasStore.isPreviewOpened &&
        <dialog open={canvasStore.isPreviewOpened}>
          <IframePreview canvasStore={canvasStore} />
        </dialog>
      }
      {canvasStore.isTemplatesModalOpen &&
        <TemplateModal 
          isOpen={canvasStore.isTemplatesModalOpen}
          handleClose={() => {canvasStore.toggleTemplates(false)}}
          handleLoad={(id) => {canvasStore.loadTemplate(id)}}
        />
      }
    </div>
  );
});

const ElementRenderer: React.FC<{ element: Element, elementsStore: ElementsStore }> = observer(({ element }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: element.type,
    item: element,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <div
      className={element.type}
      key={element.text}
      ref={drag}
      style={{
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {element.text}
    </div>
  );
});

const Elements: React.FC<{ elementsStore: ElementsStore }> = observer(({ elementsStore }) => {
  useEffect(() => {
    elementsStore.register([
      new RowElement({ cols: 1, text: '1' }),
      new RowElement({ cols: 2, text: '1|1' }),
      new RowElement({ cols: 3, text: '1|1|1' }),
      new TextElement({ text: 'Text' }),
      new ImageElement({text: 'Image'}),
      new SidebarElement({ text: 'Sidebar' })
    ]);
  }, []);

  return (
    <div className="builder__elements">
      <div>Elements</div>
      <div>
        {elementsStore.elements.map((element, index) => {
          return <ElementRenderer key={index} elementsStore={elementsStore} element={element} />;
        })}
      </div>
    </div>
  );
});

const ElementSettings: React.FC<{canvasStore: CanvasStore}> = observer(({ canvasStore }) => {
  return (
    <div className="builder__element-settings">
       <>
          <div>Global settings:</div>
            <ColorPicker
              key='global_brand'
              label='Brand'
              value={canvasStore?.nodes.globalSettings.palette.brand}
              onChange={(val) => {
                canvasStore.updateGlobalSettings('palette', 'brand',  val)
              }}
            />
            <ColorPicker
              key='global_accent'
              label='Accent'
              value={canvasStore?.nodes.globalSettings.palette.accent}
              onChange={(val) => {
                canvasStore.updateGlobalSettings('palette', 'accent',  val)
              }}
            />
            <ColorPicker
              key='global_text'
              label='Text'
              value={canvasStore?.nodes?.globalSettings.palette.text}
              onChange={(val) => {
                canvasStore.updateGlobalSettings('palette', 'text',  val)
              }}
            />
            <ColorPicker
              key='global_background'
              label='Background'
              value={canvasStore?.nodes?.globalSettings.palette.background}
              onChange={(val) => {
                canvasStore.updateGlobalSettings('palette', 'background',  val)
              }}
            />
            <ColorPicker
              key='global_onBrand'
              label='On Brand'
              value={canvasStore?.nodes?.globalSettings.palette.onBrand}
              onChange={(val) => {
                canvasStore.updateGlobalSettings('palette', 'onBrand',  val)
              }}
            />
          </>
          <hr/>
      {canvasStore.selectedNode &&
        <>
         <div>Node settings:</div>
          <RadioSwitch
            key='local_fontSize'
            label={`Size: `}
            options={[
              { label: 'Sm', value: `8px` },
              { label: 'Md', value: `16px` },
              { label: 'Lg', value: `32px` },
            ]}
            value={canvasStore?.selectedNode?.settings.styling.fontSize}
            onChange={(val) => {
              canvasStore.updateNodeSettings('styling', 'fontSize',  val)
            }}
          />
          <RadioSwitch
            key='local_spacing'
            label={`Spacing: `}
            options={[
              { label: 'Sm', value: `1` },
              { label: 'Md', value: `2` },
              { label: 'Lg', value: `3` },
            ]}
            value={canvasStore?.selectedNode?.settings.styling.spacing}
            onChange={(val) => {
              canvasStore.updateNodeSettings('styling', 'spacing',  val)
            }}
          />
          <RadioSwitch
            key='local_radius'
            label={`Radius: `}
            options={[
              { label: 'Sm', value: `5px` },
              { label: 'Md', value: `10px` },
              { label: 'Lg', value: `20px` },
            ]}
            value={canvasStore?.selectedNode?.settings.styling.radius}
            onChange={(val) => {
              canvasStore.updateNodeSettings('styling', 'radius',  val)
            }}
          />
          <RadioSwitch
            key='local_weight'
            label={`Weight: `}
            options={[
              { label: 'Sm', value: `300` },
              { label: 'Md', value: `500` },
              { label: 'Lg', value: `900` },
            ]}
            value={canvasStore?.selectedNode?.settings.styling.weight}
            onChange={(val) => {
              canvasStore.updateNodeSettings('styling', 'weight',  val)
            }}
          />
          {canvasStore.selectedNode.type === 'text-node' &&
          <>
            <ColorPicker
              key='local_text'
              label='Text'
              value={canvasStore?.selectedNode?.localSettings.palette.text || canvasStore?.nodes?.globalSettings.palette.text}
              onChange={(val) => {
                canvasStore.updateNodeSettings('palette', 'text',  val)
              }}
            />
            <ColorPicker
              key='local_background'
              label='Background'
              value={canvasStore?.selectedNode?.localSettings.palette.background || canvasStore?.nodes?.globalSettings.palette.background}
              onChange={(val) => {
                canvasStore.updateNodeSettings('palette', 'background',  val)
              }}
            />
            <TextInput
                key='local_text_val'
                value={canvasStore.selectedNode.text}
                onChange={(val)=>{canvasStore.updateNodeText(val)}}
                label='text'
              />
            </>
          }
          {canvasStore.selectedNode.type === 'sidebar-node' &&
            <>
              <ColorPicker
                  key='local_brand'
                  label='Background'
                  value={canvasStore?.selectedNode?.localSettings.palette.brand || canvasStore?.nodes?.globalSettings.palette.brand}
                  onChange={(val) => {
                    canvasStore.updateNodeSettings('palette', 'brand',  val)
                  }}
                />
              <ColorPicker
                key='local_text'
                label='Text'
                value={canvasStore?.selectedNode?.localSettings.palette.onBrand || canvasStore?.nodes?.globalSettings.palette.onBrand}
                onChange={(val) => {
                  canvasStore.updateNodeSettings('palette', 'onBrand',  val)
                }}
              />
              {canvasStore.selectedNode?.settings.list.map((setting, index) => (
                <>
                  <TextInput
                    key='local_list'
                    value={setting.id}
                    onChange={(val)=>{canvasStore.updateNodeSettings('list', index, { ...setting, id: val })}}
                    label='id'
                    disabled
                  />
                  <TextInput
                    key='local_list2'
                    key={index}
                    value={setting.name}
                    onChange={(val)=>{canvasStore.updateNodeSettings('list', index, { ...setting, name: val })}}
                    label='name'
                  />
                  <hr/>
                </>
              ))}
            </>
          }
        </>
      }
    </div>
  );
});

const TemplateModal = observer(({isOpen, handleClose, handleLoad}) => {
  const [templates, setTemplates] = useState([])
  const [name, setName] = useState('')
  const reloadTemplates = ()=>{
    const data = localStorage.getItem('templates');
  
      if (data) {
        const parsedData = JSON.parse(data)
        setTemplates(parsedData)
      }
  }
  useEffect(()=>{
    reloadTemplates()
  }, [])
  return (
    <dialog open={isOpen} >
      <div className='modal'>
        <button className="close" onClick={() => { handleClose() }}>
          ❌
        </button>
        <p>Templates</p>
        <div>
          {Object.keys(templates).map((k, idx) => (
            <div key={idx}>{k} <button onClick={()=>{handleLoad(k)}}>⬇️</button></div>
          ))}
        </div>
        <hr/>
        <div className='template_save'>
          <span>Save current as template: </span>
          <TextInput value={name} onChange={(val)=>{setName(val)}} />
          <button onClick={() => {
             canvasStore.saveAsTemplate(name)
             reloadTemplates()
          }}>
            📙
          </button>
        </div>
      </div>
    </dialog>
  )
})

export default observer(function App() {
  useEffect(() => {
    const data = localStorage.getItem('canvas')
    if (data){
      if (window.location.search === '') {
        window.location.search = `id=root`
      }
    }
  }, [])

  return (
    <div className="App">
      <Builder>
        <DndProvider backend={HTML5Backend}>
          <ElementSettings canvasStore={canvasStore} />
          <Elements elementsStore={elementsStore} />
          <Canvas canvasStore={canvasStore} elementsStore={elementsStore} />
        </DndProvider>
      </Builder>

    </div>
  );
})

