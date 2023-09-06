import React, { useEffect } from 'react';
import './index.css';

import { makeAutoObservable, toJS } from 'mobx';
import { observer } from 'mobx-react-lite';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import classNames from 'classnames';

// ---

const genUUID = (): string => crypto.randomUUID();

// ---

type ElementType = 'row' | 'text';
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

class ElementsStore {
  constructor() {
    makeAutoObservable(this);
  }

  elements: Element[] = [];

  register(elements: Element[]) {
    this.elements = elements;
  }
}

const elementsStore = new ElementsStore();

// ---

interface Node {
  id: string;
  type: string;
  className: string;
  text: string;
  // TODO: list?
  children: Record<string, Node>;
  parent: Node | null;
}

class RootNode implements Node {
  id = 'root';
  type = 'root-node';
  className = 'root-node';
  text = 'root';
  children: Record<string, RowNode> = {};
  parent = null;
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
        switch (node.type) {
          case 'text-node':
            return new TextNode(node as TextNode, this);
          default:
            return node;
        }
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

  constructor(node: TextNode | TextElement, parentNode: Node) {
    this.text = node.text;
    this.parent = parentNode;
  }
}

interface Adapter {
  save(rootNode: RootNode): void;
  load(): RootNode | null;
  clear(): void;
}

class LocalStorageAdapter implements Adapter {
  save(rootNode: RootNode) {
    localStorage.setItem('canvas', JSON.stringify(rootNode));
  }

  load(): RootNode | null {
    const data = localStorage.getItem('canvas');

    if (data) {
      return JSON.parse(data);
    }
    return null;
  }

  clear() {
    localStorage.removeItem('canvas');
  }
}

class CanvasStore {
  nodes = new RootNode();

  selectedNode: Node | null = null;

  saveAdapters: Adapter[] = [];
  loadAdapters: Adapter[] = [];

  constructor() {
    makeAutoObservable(this);

    this.registerAdapters();

    this.load();
  }

  setSelectedNode(node: Node) {
    this.selectedNode = node;
  }

  addRowNode(elem: RowElement) {
    const rowNode = new RowNode({ cols: elem.cols, parentNode: this.nodes });

    this.nodes.children[rowNode.id] = rowNode;
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
    if (node instanceof TextNode) {
      delete node.parent.children[node.id];

      parenNode.children[node.id] = node;
      node.parent = parenNode;
    }
    // create
    if (node instanceof TextElement) {
      const textNode = new TextNode(node, parenNode);

      parenNode.children[textNode.id] = textNode;
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
      adapter.save(this.getPlainNodes());
    });
  }

  clear() {
    this.saveAdapters.forEach((adapter) => {
      adapter.clear();
    });
    this.nodes = new RootNode();
  }

  load() {
    this.loadAdapters.forEach((adapter) => {
      const data = adapter.load();

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

const TextNodeRenderer: React.FC<{ node: TextNode; canvasStore: CanvasStore }> = observer(
  ({ node, canvasStore }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
      type: 'text',
      item: node,
      collect: (monitor) => ({
        isDragging: !!monitor.isDragging(),
      }),
    }));

    return (
      <div
        className={node.className}
        ref={drag}
        style={{
          background: isDragging ? 0.5 : 1,
        }}
      >
        <div>{node.text}</div>
        <NodeControls onRemove={() => canvasStore.removeNode(node)} />
      </div>
    );
  }
);

const ColNodeRenderer: React.FC<{ node: ColNode; canvasStore: CanvasStore }> = observer(
  ({ node: col, canvasStore }) => {
    const [{ isOver }, drop] = useDrop(
      () => ({
        accept: 'text',
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
        {Object.values(col.children).map((node) => {
          // TODO: strategy
          if (node instanceof TextNode) {
            return <TextNodeRenderer key={node.id} node={node} canvasStore={canvasStore} />;
          }
        })}
      </div>
    );
  }
);

const NodeControls: React.FC<{ onRemove: () => void }> = observer(({ onRemove }) => {
  return (
    <div className="controls">
      <div onClick={onRemove}>ⅹ</div>
    </div>
  );
});

const RowNodeRenderer: React.FC<{
  node: RowNode;
  canvasStore: CanvasStore;
}> = observer(({ node, canvasStore }) => {
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
      onClick={() => canvasStore.setSelectedNode(node)}
      ref={drag}
      style={{
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <NodeControls onRemove={() => canvasStore.removeNode(node)} />

      {Object.values(node.children).map((node) => (
        <ColNodeRenderer key={node.id} node={node} canvasStore={canvasStore} />
      ))}
    </div>
  );
});

const Canvas: React.FC<{ canvasStore: CanvasStore }> = observer(({ canvasStore }) => {
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: 'row',
      drop: (item: RowElement) => {
        canvasStore.addRowNode(item);
      },
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    })
    // [x, y] deps!
  );
  const rootEl = canvasStore.nodes;

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
      <div className={classNames('root', { 'root--is-over': isOver })} ref={drop}>
        <div>root elem</div>

        {Object.values(rootEl.children).map((node) => {
          return <RowNodeRenderer key={node.id} node={node} canvasStore={canvasStore} />;
        })}
      </div>
    </div>
  );
});

const ElementRenderer: React.FC<{ element: Element }> = observer(({ element }) => {
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
    ]);
  }, []);

  return (
    <div className="builder__elements">
      <div>Elements</div>
      <div>
        {elementsStore.elements.map((element, index) => {
          return <ElementRenderer key={index} element={element} />;
        })}
      </div>
    </div>
  );
});

// const ElementSettings: React.FC = () => {
//   return <div className="builder__element-settings">ElementSettings</div>;
// };

// const UISettings: React.FC = () => {
//   return <div>UISettings</div>;
// };

// ---

export default function App() {
  return (
    <div className="App">
      <Builder>
        <DndProvider backend={HTML5Backend}>
          {/* <ElementSettings /> */}
          <Elements elementsStore={elementsStore} />
          <Canvas canvasStore={canvasStore} />
        </DndProvider>
      </Builder>
    </div>
  );
}
