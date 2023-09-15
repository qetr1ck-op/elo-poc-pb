import React, { useEffect } from 'react';
import './index.css';

import { makeAutoObservable, toJS } from 'mobx';
import { observer } from 'mobx-react-lite';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import classNames from 'classnames';
import { RadioSwitch } from './RadioSwitch'
import { TextInput } from './TextInput'
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

interface TextSettings {
  type: 'text-settings'
  list: {
    size: string
    weight: string
  }
}

const defaultTextSettings: TextSettings = {
  type: 'text-settings',
  list: { size: 'font-size-md', weight: 'font-weight-md' },
}

class TextElement implements Element {
  type: ElementType = 'text';
  text: string;
  settings: TextSettings

  constructor(options: { text: string, settings?: TextSettings }) {
    this.text = options.text;
    this.settings = options.settings || defaultTextSettings;
  }
}

interface ImageSettings {
  type: 'image-settings'
  list: {
    src: string
    opacity: number
  }
}

const defaultImageSettings: ImageSettings = {
  type: 'image-settings',
  list: {
    src: '/image.jpg',
    opacity: 1,
  }
}

class ImageElement implements Element {
  type: ElementType = 'image';
  text: string;
  settings: ImageSettings

  constructor(options: { text: string, settings?: ImageSettings }) {
    this.text = options.text;
    this.settings = options.settings || defaultImageSettings;
  }
}

interface SidebarSettings {
  type: 'sidebar-settings'
  list: {name: string, id: string}[]
}

const defaultSidebarSettings: SidebarSettings = {
  type: 'sidebar-settings',
  list: [
    {name: 'first', id: 'root',
    },
    {
      name: 'second', id: 'root2'
    }
  ]
}

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

    const isNewNode = !options.node;

    if (isNewNode) {
      this.create(options.cols);
    } else {
      this.update(options.node as RowNode);
    }

    this.parent = options.parentNode;
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
    if (node) {
      this.update(node);
    }
    this.parent = parentNode;
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
  settings: TextSettings

  constructor(node: TextNode | TextElement, parentNode: Node) {
    makeAutoObservable(this)
    this.text = node.text;
    this.parent = parentNode;
    this.settings = node?.settings || defaultTextSettings;
  }
}

class ImageNode implements Node {
  id = genUUID();
  type = 'image-node';
  className = 'image-node';
  text: string;
  children: Record<string, Node> = {};
  parent: Node;
  settings: ImageSettings

  constructor(node: ImageElement, parentNode: Node) {
    makeAutoObservable(this)
    this.text = node.text;
    this.parent = parentNode;
    this.settings = node?.settings || defaultImageSettings;
  }
}

class SidebarNode implements Node {
  id = genUUID();
  type = 'sidebar-node';
  className = 'sidebar-node';
  text: string;
  children: Record<string, Node> = {};
  parent: Node;
  settings: SidebarSettings

  constructor(node: SidebarNode, parentNode: Node) {
    makeAutoObservable(this)
    this.text = node.text;
    this.parent = parentNode;
    this.settings = node.settings
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
      const sidebarNode = new TextNode(node, parenNode);
      parenNode.children[sidebarNode.id] = sidebarNode;
    } else if (node instanceof ImageElement) {
      const imageNode = new ImageNode(node, parenNode);
      parenNode.children[imageNode.id] = imageNode;
    }
  }

  updateNodeSettings (key: string, value: string) {
    if (this.selectedNode) {
      this.selectedNode.settings.list[key] = value
    }
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
    const nodes = this.removeParentNode({ ...this.nodes, children: { ...this.nodes.children } });

    return toJS(nodes) as RootNode;
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

      this.nodes.children = Object.values(data.children)
        .map((node) => new RowNode({ node, parentNode: this.nodes }))
        .reduce((acc, el) => {
          acc[el.id] = el;
          return acc;
        }, map);
    });
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
          background: isDragging ? 'greenyellow' : '',
        }}
      >
        <div className={`text-value ${Object.values(node.settings.list).join(' ')}`}>{node.text}</div>
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
        // style={{
        //   background: isDragging ? 'greenyellow' : '',
        // }}
      >
        <div className={`image-value`}>
          <img src={node.settings.list.src} />
        </div>
        <NodeControls onRemove={() => canvasStore.removeNode(node)} />
      </div>
    );
  }
);

const ColNodeRenderer: React.FC<{ node: ColNode; canvasStore: CanvasStore, elementsStore: ElementsStore }> = observer(
  ({ node: col, canvasStore }) => {
    const [{ isOver }, drop] = useDrop(
      () => ({
        accept: ['text', 'sidebar', 'image'],
        drop: (item: Node | Element) => {
        
          if (Object.values(col.children).length === 0) {
            canvasStore.addNode(item, col);
          }
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

const SidebarRenderer = observer(({ node, canvasStore}: {node: SidebarNode, canvasStore: CanvasStore}) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'text',
    item: node,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <ul className='sidebar-node' ref={drag} style={{scale: isDragging ? 1 : 0.8}} onClick={(e) => {
      canvasStore.setSelectedNode(node)
    }}>
      <NodeControls onRemove={() => canvasStore.removeNode(node)} />
      {node.settings.list.map(({name}, index: number) => (<li key={index}>{name}</li>))}
    </ul>
  )
})

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
      {canvasStore?.selectedRowNode &&
        <>
          <div>Block Settings:</div>
          {canvasStore?.selectedRowNode?.text}-{Object.values(toJS(canvasStore?.selectedRowNode?.children)|| {}).length}
          <hr />
        </>
      }

        {canvasStore.selectedNode?.settings.type === 'text-settings' &&
         <>
         <div>Node Settings:</div>
          {Object.keys(canvasStore.selectedNode?.settings.list).map((settingName) => (
            <RadioSwitch
            key={settingName}
           label={`${settingName}: `}
           options={[{
             label: 'Sm',
             value: `font-${settingName}-sm`
           },
           {
             label: 'Md',
             value: `font-${settingName}-md`
           },
           {
             label: 'Lg',
             value: `font-${settingName}-lg`
           }]}
           value={canvasStore?.selectedNode?.settings.list[settingName]}
           onChange={(val) => {
             canvasStore.updateNodeSettings(settingName,  val)
           }}
         />
         ))}
        </>
      }
      {canvasStore.selectedNode?.settings.type === 'sidebar-settings' &&
        <>
          <div>Node Settings:</div>
          {canvasStore.selectedNode?.settings.list.map((setting, index) => (
            <>
              <TextInput
                value={setting.id}
                onChange={(val)=>{canvasStore.updateNodeSettings(index, { ...setting, id: val })}}
                label='id'
                disabled
              />
              <TextInput
                key={index}
                value={setting.name}
                onChange={(val)=>{canvasStore.updateNodeSettings(index, { ...setting, name: val })}}
                label='name'
              />
              <hr/>
            </>
          ))}
        </>
      }
    </div>
  );
});

export default function App() {
  useEffect(() => {
    const data = localStorage.getItem('canvas')
    if (data){
      const parsedData = JSON.parse(data)
      const firstId = Object.keys(parsedData)[0]
      const queryId = window.location.search.split('=')[1]

      if (firstId && `${queryId}` !== `${firstId}`) {
        // window.location.search = `id=${firstId}`
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
}

