import React, { useEffect } from 'react';
import './index.css';

import { makeAutoObservable, makeObservable, observable, toJS } from 'mobx';
import { observer } from 'mobx-react-lite';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import classNames from 'classnames';

// ---

const genUUID = (): string => crypto.randomUUID();

// ---

interface Element {
  type: string;
  text: string;
}

class LayoutElement implements Element {
  type = 'layout';
  cols = 1;
  text: string;

  constructor(options: { cols: number; text: string }) {
    this.cols = options.cols;
    this.text = options.text;
  }
}

class TextElement implements Element {
  type = 'text';
  cols = 1;
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
  children: Record<string, Node>;
  parentNode: Node | null;
}

class TextNode implements Node {
  id = genUUID();
  type = 'text-node';
  className = 'text-node';
  text: string;
  children: Record<string, Node> = {};

  parentNode: Node;

  constructor(textNode: TextNode, parentNode: Node) {
    this.text = textNode.text;
    this.parentNode = parentNode;
  }
}

class RowNode implements Node {
  id = genUUID();
  type = 'row-node';
  className = 'row-node';
  text = 'row';
  children: Record<string, Node> = {};
  parentNode: RootNode;

  constructor(options: { cols?: number; row?: RowNode; parentNode: RootNode }) {
    makeAutoObservable(this);

    if (options.row) {
      this.id = options.row.id;
      this.text = options.row.text;

      const map: Record<string, Node> = {};
      this.children = Object.values(options.row.children)
        .map((node) => {
          // if (node.type === 'col-node') {
          return new ColNode(node, this);
          // }
        })
        .reduce((acc, el) => {
          acc[el.id] = el;
          return acc;
        }, map);
    } else {
      this.creteColNodes(options.cols, options.parentNode);
    }

    this.parentNode = options.parentNode;
  }

  creteColNodes(cols: number, row: RowNode) {
    const map: Record<string, Node> = {};

    this.children = new Array(cols)
      .fill(null)
      .map(() => new ColNode(null, row))
      .reduce((acc, el) => {
        acc[el.id] = el;
        return acc;
      }, map);
  }

  // parseColNodes(cols: Record<string, ColNode>) {

  //   Object.values(cols).map((col) => {
  //     new ColNode(col)
  //   })
  // }
}

class ColNode implements Node {
  id = genUUID();
  type = 'col-node';
  className = 'col-node';
  text = 'col';
  children: Record<string, Node> = {};
  parentNode: Node;

  constructor(col: ColNode, parentNode: Node) {
    makeAutoObservable(this);
    if (col) {
      this.id = col.id;
      this.text = col.text;

      const map: Record<string, Node> = {};
      this.children = Object.values(col.children)
        .map((node) => {
          // if (node.type === 'text-node') {
          return new TextNode(node, this);
          // }
          // return node;
        })
        .reduce((acc, el) => {
          acc[el.id] = el;
          return acc;
        }, map);
    }

    this.parentNode = parentNode;
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

interface RootNode {
  id: 'root';
  children: Record<string, Node>;
}

class CanvasStore {
  constructor() {
    makeAutoObservable(this);

    this.registerAdapters();

    this.load();
  }

  nodes: RootNode = {
    id: 'root',
    children: {},
  };

  selectedNodeId: string | null = null;

  saveAdapters: Adapter[] = [];
  loadAdapters: Adapter[] = [];

  setSelectedNodeId(id: string | null) {
    this.selectedNodeId = id;
  }

  addRowNode(elem: LayoutElement) {
    const rowNode = new RowNode({ cols: elem.cols, parentNode: this.nodes });

    this.nodes.children[rowNode.id] = rowNode;
  }

  removeRowNode(node: RowNode) {
    delete node.parentNode.children[node.id];
  }

  removeColChildNode(node: Node) {
    delete node.parentNode.children[node.id];
  }

  addTextNode(parenNode: Node, textElOrNode: TextElement | TextNode) {
    // move
    if (textElOrNode instanceof TextNode) {
      delete textElOrNode.parentNode.children[textElOrNode.id];

      parenNode.children[textElOrNode.id] = textElOrNode;
      textElOrNode.parentNode = parenNode;
    }
    // create
    if (textElOrNode instanceof TextElement) {
      const textNode = new TextNode(textElOrNode, parenNode);

      parenNode.children[textNode.id] = textNode;
    }
  }

  registerAdapters() {
    const localStorageAdapter = new LocalStorageAdapter();

    this.saveAdapters.push(localStorageAdapter);
    this.loadAdapters.push(localStorageAdapter);
  }

  // Function to recursively set parentNode to null
  private setParentNodeToNull(node: Node) {
    // Set the parentNode of the current node to null
    node.parentNode = null;

    // Recursively process child nodes
    for (const key in node.children) {
      if (node.children.hasOwnProperty(key)) {
        this.setParentNodeToNull(node.children[key]);
      }
    }

    return node;
  }
  private getPlainNodes() {
    // plain structure without mobx/circular refs
    const nodes = this.setParentNodeToNull({ ...this.nodes, children: { ...this.nodes.children } });

    return toJS(nodes);
  }

  // private toRecursiveNodes(node: Node, parent = null) {
  //   // Set the parentNode property to the actual parent
  //   node.parentNode = parent;

  //   // Recursively process child nodes
  //   for (const key in node.children) {
  //     if (node.children.hasOwnProperty(key)) {
  //       this.toRecursiveNodes(node.children[key], node);
  //     }
  //   }
  // }

  save() {
    this.saveAdapters.forEach((adapter) => {
      adapter.save(this.getPlainNodes());
    });
  }

  clear() {
    this.saveAdapters.forEach((adapter) => {
      adapter.clear();
    });
    this.nodes = {
      id: 'root',
      children: {},
    };
  }

  load() {
    this.loadAdapters.forEach((adapter) => {
      const data = adapter.load();

      if (!data) {
        return;
      }

      this.nodes.children = Object.values((data as unknown as RootNode).children)
        .map((node) => {
          // if (node.type === 'row-node') {
          return new RowNode({ row: node, parentNode: this.nodes });
          // }
        })
        .reduce((acc, el) => {
          acc[el.id] = el;
          return acc;
        }, {});
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

const TextRenderer: React.FC<{ node: TextNode; onRemove: () => void }> = observer(
  ({ node, onRemove }) => {
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
        <NodeControls onRemove={onRemove} />
      </div>
    );
  }
);

const ColRenderer: React.FC<{ col: ColNode; row: RowNode; canvasStore: CanvasStore }> = observer(
  ({ col, row, canvasStore }) => {
    const [{ isOver }, drop] = useDrop(
      () => ({
        accept: 'text',
        drop: (item: TextElement | TextNode) => {
          console.log('item', item);

          canvasStore.addTextNode(col, item);
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
        {Object.values(col.children).map((node: TextNode) => (
          // if (node.type === 'text-node') {
          <TextRenderer node={node} onRemove={() => canvasStore.removeColChildNode(node)} />
        ))}
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
  node: Node;
  onClick: (el: Node) => void;
  onRemove: (el: Node) => void;
}> = observer(({ node, onClick, onRemove }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'layout__inner',
    item: node,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <div
      className={node.className}
      onClick={() => onClick(node)}
      ref={drag}
      style={{
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <NodeControls onRemove={() => onRemove(node)} />

      {Object.values(node.children).map((col: ColNode) => {
        return <ColRenderer key={node.id} row={node} col={col} canvasStore={canvasStore} />;
      })}
    </div>
  );
});

const Canvas: React.FC<{ canvasStore: CanvasStore }> = observer(({ canvasStore }) => {
  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: 'layout',
      drop: (item: LayoutElement) => {
        canvasStore.addRowNode(item);
      },
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    })
    // [x, y] deps!
  );
  const rootEl = canvasStore.nodes;

  console.log('rootEl', rootEl);

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

        {Object.values(rootEl.children).map((node: RowNode) => {
          return (
            <RowNodeRenderer
              key={node.id}
              node={node}
              onClick={(node) => {
                canvasStore.setSelectedNodeId(node.id);
              }}
              onRemove={(node) => {
                canvasStore.removeRowNode(node);
              }}
            />
          );
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
      new LayoutElement({ cols: 1, text: '1' }),
      new LayoutElement({ cols: 2, text: '1|1' }),
      new LayoutElement({ cols: 3, text: '1|1|1' }),
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
