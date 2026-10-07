import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Box, Shapes, Plug, ListOrdered, Plus, Trash2, Copy, Download, Upload,
  RotateCcw, Save, FileCode2, Network, ZoomIn, ZoomOut, Maximize,
  X, ChevronDown, ChevronRight, Compass, Link2, GripVertical, Info
} from "lucide-react";

/* ----------------------------- constants ----------------------------- */

const uid = () => Math.random().toString(36).slice(2, 10);
const NODE_W = 252;

const TYPE_META = {
  class:     { label: "Class",           stereotype: null,              color: "#5AC0E8", accent: "#2A6E8C" },
  abstract:  { label: "Abstract Class",  stereotype: "\u00ABabstract\u00BB",     color: "#E8A33D", accent: "#8C5E1F" },
  interface: { label: "Interface",       stereotype: "\u00ABinterface\u00BB",    color: "#B085E8", accent: "#5E3E8C" },
  enum:      { label: "Enumeration",     stereotype: "\u00ABenumeration\u00BB",  color: "#54C98F", accent: "#256B49" },
};

const PALETTE = [
  { type: "class",     icon: Box,         label: "Class" },
  { type: "abstract",  icon: Shapes,      label: "Abstract Class" },
  { type: "interface", icon: Plug,        label: "Interface" },
  { type: "enum",      icon: ListOrdered, label: "Enum" },
];

const REL_META = {
  association:  { label: "Association",  short: "\u2014\u2014",  dash: false, end: "open",     start: null },
  inheritance:  { label: "Inheritance",   short: "\u2014\u25B7",  dash: false, end: "triangle", start: null },
  realization:  { label: "Realization",   short: "- - \u25B7",    dash: true,  end: "triangle", start: null },
  aggregation:  { label: "Aggregation",   short: "\u25C7\u2014",  dash: false, end: null,       start: "diamondOpen" },
  composition:  { label: "Composition",   short: "\u25C6\u2014",  dash: false, end: null,       start: "diamondFilled" },
  dependency:   { label: "Dependency",    short: "- - \u003E",    dash: true,  end: "open",     start: null },
};

const VIS_SYMBOL = { public: "+", private: "-", protected: "#" };
const JAVA_TYPES = ["String", "int", "long", "double", "float", "boolean", "Long", "Integer", "Double", "Boolean", "char", "Object"];

/* ------------------------------ starter -------------------------------- */

function starterProject() {
  return {
    nodes: [
      { id: "payable", type: "interface", name: "Payable", x: 60, y: 40,
        attributes: [],
        methods: [ { id: uid(), visibility: "public", name: "pay", returnType: "boolean", params: "double amount", abstract: true } ],
        values: [] },
      { id: "account", type: "abstract", name: "Account", x: 60, y: 260,
        attributes: [
          { id: uid(), visibility: "protected", name: "id", type: "Long" },
          { id: uid(), visibility: "protected", name: "email", type: "String" },
        ],
        methods: [ { id: uid(), visibility: "public", name: "authenticate", returnType: "boolean", params: "", abstract: true } ],
        values: [] },
      { id: "customer", type: "class", name: "Customer", x: 440, y: 150,
        attributes: [
          { id: uid(), visibility: "private", name: "name", type: "String" },
          { id: uid(), visibility: "private", name: "loyaltyPoints", type: "int" },
        ],
        methods: [
          { id: uid(), visibility: "public", name: "pay", returnType: "boolean", params: "double amount", abstract: false },
          { id: uid(), visibility: "public", name: "authenticate", returnType: "boolean", params: "", abstract: false },
        ],
        values: [] },
      { id: "order", type: "class", name: "Order", x: 840, y: 150,
        attributes: [
          { id: uid(), visibility: "private", name: "orderId", type: "Long" },
          { id: uid(), visibility: "private", name: "total", type: "double" },
          { id: uid(), visibility: "private", name: "status", type: "OrderStatus" },
        ],
        methods: [ { id: uid(), visibility: "public", name: "calculateTotal", returnType: "double", params: "", abstract: false } ],
        values: [] },
      { id: "status", type: "enum", name: "OrderStatus", x: 840, y: 420,
        attributes: [], methods: [],
        values: [ { id: uid(), name: "PENDING" }, { id: uid(), name: "PAID" }, { id: uid(), name: "SHIPPED" }, { id: uid(), name: "DELIVERED" }, { id: uid(), name: "CANCELLED" } ] },
    ],
    relations: [
      { id: uid(), from: "customer", to: "account", type: "inheritance", label: "", fromCard: "", toCard: "" },
      { id: uid(), from: "customer", to: "payable", type: "realization", label: "", fromCard: "", toCard: "" },
      { id: uid(), from: "customer", to: "order", type: "association", label: "places", fromCard: "1", toCard: "*" },
      { id: uid(), from: "order", to: "status", type: "dependency", label: "uses", fromCard: "", toCard: "" },
    ],
  };
}

function blankNode(type, x, y) {
  const n = { id: uid(), type, name: TYPE_META[type].label.replace(/\s/g, ""), x, y, attributes: [], methods: [], values: [] };
  if (type === "enum") n.values = [{ id: uid(), name: "VALUE_ONE" }, { id: uid(), name: "VALUE_TWO" }];
  if (type === "interface") n.methods = [{ id: uid(), visibility: "public", name: "doSomething", returnType: "void", params: "", abstract: true }];
  else if (type !== "enum") n.attributes = [{ id: uid(), visibility: "private", name: "field", type: "String" }];
  return n;
}

/* --------------------------- java generation --------------------------- */

function lowerFirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

function generateJava(node, nodes, relations) {
  const byId = (id) => nodes.find((n) => n.id === id);
  const extendsRel = relations.find((r) => r.type === "inheritance" && r.from === node.id);
  const implementsRels = relations.filter((r) => r.type === "realization" && r.from === node.id);
  const relFields = relations.filter((r) => ["association", "aggregation", "composition"].includes(r.type) && r.from === node.id);

  let usesList = false;
  const relFieldLines = relFields.map((r) => {
    const target = byId(r.to);
    if (!target) return null;
    const many = r.toCard && r.toCard.trim() !== "1" && r.toCard.trim() !== "0..1" && r.toCard.trim() !== "";
    const fname = lowerFirst(target.name) + (many ? "List" : "");
    const ftype = many ? `List<${target.name}>` : target.name;
    if (many) usesList = true;
    return `    private ${ftype} ${fname}; // ${r.type}${r.label ? " \u2022 " + r.label : ""}`;
  }).filter(Boolean);

  if (node.type === "interface") {
    const ext = extendsRel ? ` extends ${byId(extendsRel.to) ? byId(extendsRel.to).name : ""}` : "";
    const consts = node.attributes.map((a) => `    ${a.type} ${a.name.toUpperCase()} = null; // constant`).join("\n");
    const methods = node.methods.map((m) => `    ${m.returnType} ${m.name}(${m.params || ""});`).join("\n");
    const body = [consts, methods].filter(Boolean).join("\n\n");
    return `public interface ${node.name}${ext} {\n${body ? body : "\n"}\n}`;
  }

  if (node.type === "enum") {
    const vals = node.values.map((v) => v.name).join(", ");
    const hasBody = node.attributes.length > 0 || node.methods.length > 0;
    const attrs = node.attributes.map((a) => `    private final ${a.type} ${a.name};`).join("\n");
    const methods = node.methods.map((m) => {
      const ret = m.returnType === "void" ? "" : "        return " + (m.returnType === "boolean" ? "false" : "null") + ";\n";
      return `    public ${m.returnType} ${m.name}(${m.params || ""}) {\n        // TODO: implement\n${ret}    }`;
    }).join("\n\n");
    const body = [attrs, methods].filter(Boolean).join("\n\n");
    return `public enum ${node.name} {\n    ${vals}${hasBody ? ";\n\n" + body : ";"}\n}`;
  }

  // class / abstract
  const kw = node.type === "abstract" ? "abstract class" : "class";
  const ext = extendsRel && byId(extendsRel.to) ? ` extends ${byId(extendsRel.to).name}` : "";
  const impl = implementsRels.length ? ` implements ${implementsRels.map((r) => (byId(r.to) ? byId(r.to).name : "")).join(", ")}` : "";

  const attrLines = node.attributes.map((a) => `    ${a.visibility} ${a.type} ${a.name};`);
  const allFieldLines = [...attrLines, ...relFieldLines];

  const methodLines = node.methods.map((m) => {
    if (m.abstract) return `    ${m.visibility} abstract ${m.returnType} ${m.name}(${m.params || ""});`;
    const ret = m.returnType === "void" ? "" : "        return " + (m.returnType === "boolean" ? "false" : m.returnType === "int" || m.returnType === "long" || m.returnType === "double" || m.returnType === "float" ? "0" : "null") + ";\n";
    return `    ${m.visibility} ${m.returnType} ${m.name}(${m.params || ""}) {\n        // TODO: implement\n${ret}    }`;
  });

  const importLine = usesList ? "import java.util.List;\n\n" : "";
  const body = [allFieldLines.join("\n"), methodLines.join("\n\n")].filter(Boolean).join("\n\n");
  return `${importLine}public ${kw} ${node.name}${ext}${impl} {\n${body ? body : "\n"}\n}`;
}

/* --------------------------------- app ---------------------------------- */

export default function App() {
  const [project, setProject] = useState(starterProject);
  const [selectedId, setSelectedId] = useState("customer");
  const [selectedRelId, setSelectedRelId] = useState(null);
  const [tab, setTab] = useState("diagram");
  const [viewport, setViewport] = useState({ tx: 60, ty: 30, scale: 1 });
  const [connecting, setConnecting] = useState(null);
  const [popover, setPopover] = useState(null);
  const [toast, setToast] = useState(null);
  const [legendOpen, setLegendOpen] = useState(true);
  const [openSection, setOpenSection] = useState({ attrs: true, methods: true, values: true, rels: true });

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const toastTimer = useRef(null);

  const nodes = project.nodes;
  const relations = project.relations;
  const node = nodes.find((n) => n.id === selectedId) || null;
  const rel = relations.find((r) => r.id === selectedRelId) || null;

  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  const setNodes = (fn) => setProject((p) => ({ ...p, nodes: typeof fn === "function" ? fn(p.nodes) : fn }));
  const setRelations = (fn) => setProject((p) => ({ ...p, relations: typeof fn === "function" ? fn(p.relations) : fn }));

  const updateNode = (id, patch) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  const updateRel = (id, patch) => setRelations((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  /* -------- coordinate helpers -------- */
  const toContent = useCallback((clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (clientX - rect.left - viewport.tx) / viewport.scale, y: (clientY - rect.top - viewport.ty) / viewport.scale };
  }, [viewport]);

  /* -------- node drag -------- */
  const startNodeDrag = (e, n) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const startMouse = { x: e.clientX, y: e.clientY };
    const startPos = { x: n.x, y: n.y };
    let moved = false;
    const onMove = (ev) => {
      const dx = (ev.clientX - startMouse.x) / viewport.scale;
      const dy = (ev.clientY - startMouse.y) / viewport.scale;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      updateNode(n.id, { x: Math.max(0, startPos.x + dx), y: Math.max(0, startPos.y + dy) });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (!moved) { setSelectedId(n.id); setSelectedRelId(null); }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  /* -------- canvas pan -------- */
  const startPan = (e) => {
    if (e.button !== 0) return;
    setSelectedId(null); setSelectedRelId(null); setPopover(null);
    const startMouse = { x: e.clientX, y: e.clientY };
    const startVp = { ...viewport };
    const onMove = (ev) => {
      setViewport((vp) => ({ ...vp, tx: startVp.tx + (ev.clientX - startMouse.x), ty: startVp.ty + (ev.clientY - startMouse.y) }));
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  /* -------- connection drag -------- */
  const startConnect = (e, n) => {
    e.stopPropagation();
    const p0 = toContent(e.clientX, e.clientY);
    setConnecting({ fromId: n.id, x0: n.x + NODE_W / 2, y0: n.y + 26, x: p0.x, y: p0.y });
    const onMove = (ev) => {
      const p = toContent(ev.clientX, ev.clientY);
      setConnecting((c) => (c ? { ...c, x: p.x, y: p.y } : c));
    };
    const onUp = (ev) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const targetEl = el && el.closest && el.closest("[data-node-id]");
      const targetId = targetEl && targetEl.getAttribute("data-node-id");
      if (targetId && targetId !== n.id) {
        const id = uid();
        setRelations((rs) => [...rs, { id, from: n.id, to: targetId, type: "association", label: "", fromCard: "1", toCard: "*" }]);
        setSelectedRelId(id); setSelectedId(null);
        setPopover({ relId: id, x: ev.clientX, y: ev.clientY });
      }
      setConnecting(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  /* -------- palette drag-drop -------- */
  const onPaletteDragStart = (e, type) => { e.dataTransfer.setData("text/uml-type", type); e.dataTransfer.effectAllowed = "copy"; };
  const onCanvasDrop = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("text/uml-type");
    if (!type) return;
    const p = toContent(e.clientX, e.clientY);
    const n = blankNode(type, Math.max(0, p.x - NODE_W / 2), Math.max(0, p.y - 20));
    setNodes((ns) => [...ns, n]);
    setSelectedId(n.id); setSelectedRelId(null);
    flash(`${TYPE_META[type].label} added`);
  };
  const addTypeAtCenter = (type) => {
    const p = toContent(canvasRef.current.getBoundingClientRect().left + 260, canvasRef.current.getBoundingClientRect().top + 180);
    const n = blankNode(type, p.x, p.y);
    setNodes((ns) => [...ns, n]);
    setSelectedId(n.id); setSelectedRelId(null);
    flash(`${TYPE_META[type].label} added`);
  };

  /* -------- delete key -------- */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (selectedId) { deleteNode(selectedId); }
      else if (selectedRelId) { deleteRel(selectedRelId); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const deleteNode = (id) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setRelations((rs) => rs.filter((r) => r.from !== id && r.to !== id));
    setSelectedId(null);
    flash("Class removed");
  };
  const deleteRel = (id) => {
    setRelations((rs) => rs.filter((r) => r.id !== id));
    setSelectedRelId(null); setPopover(null);
    flash("Relationship removed");
  };

  /* -------- zoom -------- */
  const zoomBy = (delta) => setViewport((vp) => ({ ...vp, scale: Math.max(0.5, Math.min(1.6, +(vp.scale + delta).toFixed(2))) }));
  const resetView = () => setViewport({ tx: 60, ty: 30, scale: 1 });

  /* -------- project io -------- */
  const reset = () => { setProject(starterProject()); setSelectedId("customer"); setSelectedRelId(null); flash("Reset to starter architecture"); };
  const saveProject = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "uml-project.json"; a.click();
    flash("Project saved as JSON");
  };
  const loadProject = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed.nodes || !parsed.relations) throw new Error("bad file");
        setProject(parsed); setSelectedId(parsed.nodes[0] ? parsed.nodes[0].id : null); setSelectedRelId(null);
        flash("Project loaded");
      } catch (err) { flash("Could not read that file"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };
  const exportAllJava = () => {
    const text = nodes.map((n) => `// ---- ${n.name}.java ----\n${generateJava(n, nodes, relations)}`).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "generated-java.txt"; a.click();
    flash("Java source exported");
  };
  const downloadOne = (n) => {
    const blob = new Blob([generateJava(n, nodes, relations)], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${n.name}.java`; a.click();
  };
  const copyOne = async (n) => {
    try { await navigator.clipboard.writeText(generateJava(n, nodes, relations)); flash(`${n.name}.java copied`); }
    catch (e) { flash("Copy failed"); }
  };

  /* -------- item helpers -------- */
  const addAttribute = () => updateNode(node.id, { attributes: [...node.attributes, { id: uid(), visibility: "private", name: "newField", type: "String" }] });
  const addMethod = () => updateNode(node.id, { methods: [...node.methods, { id: uid(), visibility: "public", name: "newMethod", returnType: "void", params: "", abstract: false }] });
  const addValue = () => updateNode(node.id, { values: [...node.values, { id: uid(), name: `VALUE_${node.values.length + 1}` }] });
  const patchAttr = (id, patch) => updateNode(node.id, { attributes: node.attributes.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  const patchMethod = (id, patch) => updateNode(node.id, { methods: node.methods.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const patchValue = (id, patch) => updateNode(node.id, { values: node.values.map((v) => (v.id === id ? { ...v, ...patch } : v)) });
  const removeAttr = (id) => updateNode(node.id, { attributes: node.attributes.filter((a) => a.id !== id) });
  const removeMethod = (id) => updateNode(node.id, { methods: node.methods.filter((m) => m.id !== id) });
  const removeValue = (id) => updateNode(node.id, { values: node.values.filter((v) => v.id !== id) });

  return (
    <div className="uml-root" onMouseDown={() => setPopover(null)}>
      <StyleSheet />
      <TopBar
        onSave={saveProject}
        onLoad={() => fileInputRef.current && fileInputRef.current.click()}
        onReset={reset}
        onExport={exportAllJava}
      />
      <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={loadProject} />

      <div className="tabs-row">
        <button className={"tab" + (tab === "diagram" ? " active" : "")} onClick={() => setTab("diagram")}>
          <Network size={15} /> Blueprint
        </button>
        <button className={"tab" + (tab === "code" ? " active" : "")} onClick={() => setTab("code")}>
          <FileCode2 size={15} /> Java Source
        </button>
        <div className="tabs-spacer" />
        <div className="node-count"><span>{nodes.length}</span> classes &nbsp;\u00B7&nbsp; <span>{relations.length}</span> relations</div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {tab === "diagram" ? (
        <div className="workspace">
          <Palette onDragStart={onPaletteDragStart} onQuickAdd={addTypeAtCenter} />

          <div
            className="canvas-shell"
            ref={canvasRef}
            onMouseDown={(e) => { if (e.target === e.currentTarget || e.target.classList.contains("grid-layer")) startPan(e); }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onCanvasDrop}
            onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomBy(e.deltaY < 0 ? 0.08 : -0.08); } }}
          >
            <div
              className="grid-layer"
              style={{
                backgroundPosition: `${viewport.tx}px ${viewport.ty}px`,
                backgroundSize: `${28 * viewport.scale}px ${28 * viewport.scale}px, ${28 * viewport.scale}px ${28 * viewport.scale}px, ${140 * viewport.scale}px ${140 * viewport.scale}px, ${140 * viewport.scale}px ${140 * viewport.scale}px`,
              }}
            />

            <div className="content-layer" style={{ transform: `translate(${viewport.tx}px, ${viewport.ty}px) scale(${viewport.scale})` }}>
              <svg className="rel-svg" width="4000" height="3000">
                <defs>
                  <marker id="m-open" markerWidth="14" markerHeight="14" refX="11" refY="5" orient="auto"><path d="M1,1 L11,5 L1,9" fill="none" stroke="#7FA8C9" strokeWidth="1.6" /></marker>
                  <marker id="m-triangle" markerWidth="16" markerHeight="16" refX="12" refY="6" orient="auto"><path d="M1,1 L12,6 L1,11 Z" fill="#0A1622" stroke="#7FA8C9" strokeWidth="1.4" /></marker>
                  <marker id="m-diamondOpen" markerWidth="18" markerHeight="14" refX="1" refY="5" orient="auto-start-reverse"><path d="M1,5 L9,1 L17,5 L9,9 Z" fill="#0A1622" stroke="#7FA8C9" strokeWidth="1.4" /></marker>
                  <marker id="m-diamondFilled" markerWidth="18" markerHeight="14" refX="1" refY="5" orient="auto-start-reverse"><path d="M1,5 L9,1 L17,5 L9,9 Z" fill="#7FA8C9" stroke="#7FA8C9" strokeWidth="1.4" /></marker>
                </defs>
                {relations.map((r) => (
                  <RelationLine key={r.id} r={r} nodes={nodes} selected={selectedRelId === r.id}
                    onSelect={(e) => { e.stopPropagation(); setSelectedRelId(r.id); setSelectedId(null); setPopover({ relId: r.id, x: e.clientX, y: e.clientY }); }} />
                ))}
                {connecting && (
                  <line x1={connecting.x0} y1={connecting.y0} x2={connecting.x} y2={connecting.y} stroke="#5AC0E8" strokeWidth="2" strokeDasharray="6,4" />
                )}
              </svg>

              {nodes.map((n) => (
                <ClassNode
                  key={n.id}
                  n={n}
                  selected={selectedId === n.id}
                  onMouseDown={(e) => startNodeDrag(e, n)}
                  onConnectStart={(e) => startConnect(e, n)}
                  onDelete={() => deleteNode(n.id)}
                />
              ))}
            </div>
          </div>

          <ZoomControls scale={viewport.scale} onIn={() => zoomBy(0.1)} onOut={() => zoomBy(-0.1)} onReset={resetView} />
          <Legend open={legendOpen} onToggle={() => setLegendOpen((v) => !v)} />

          {popover && (rel || null) && (
            <RelationPopover
              rel={rel}
              nodes={nodes}
              x={popover.x}
              y={popover.y}
              onChange={(patch) => updateRel(rel.id, patch)}
              onDelete={() => deleteRel(rel.id)}
              onClose={() => setPopover(null)}
            />
          )}

          <Inspector
            node={node}
            nodes={nodes}
            relations={relations}
            openSection={openSection}
            setOpenSection={setOpenSection}
            onNameChange={(v) => updateNode(node.id, { name: v.replace(/\s/g, "") })}
            onDelete={() => deleteNode(node.id)}
            addAttribute={addAttribute} addMethod={addMethod} addValue={addValue}
            patchAttr={patchAttr} patchMethod={patchMethod} patchValue={patchValue}
            removeAttr={removeAttr} removeMethod={removeMethod} removeValue={removeValue}
          />
        </div>
      ) : (
        <CodeView nodes={nodes} relations={relations} onCopy={copyOne} onDownload={downloadOne} />
      )}
    </div>
  );
}

/* ------------------------------ components ------------------------------ */

function TopBar({ onSave, onLoad, onReset, onExport }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><Compass size={20} /></div>
        <div className="brand-text">
          <b>UML Blueprint</b>
          <small>Design classes visually &bull; generate Java automatically</small>
        </div>
      </div>
      <div className="top-actions">
        <button onClick={onLoad}><Upload size={15} /> Load</button>
        <button onClick={onSave}><Save size={15} /> Save</button>
        <button onClick={onReset}><RotateCcw size={15} /> Reset</button>
        <button className="primary" onClick={onExport}><Download size={15} /> Export Java</button>
      </div>
    </header>
  );
}

function Palette({ onDragStart, onQuickAdd }) {
  return (
    <aside className="palette">
      <div className="palette-title">Element Types</div>
      <div className="palette-hint">Drag onto the canvas, or click to drop one in</div>
      {PALETTE.map((p) => {
        const Icon = p.icon;
        const meta = TYPE_META[p.type];
        return (
          <div
            key={p.type}
            className="palette-item"
            draggable
            onDragStart={(e) => onDragStart(e, p.type)}
            onClick={() => onQuickAdd(p.type)}
            style={{ "--accent": meta.color }}
          >
            <span className="palette-icon"><Icon size={17} /></span>
            <span className="palette-label">{p.label}</span>
            <GripVertical size={14} className="palette-grip" />
          </div>
        );
      })}
      <div className="palette-divider" />
      <div className="palette-note">
        <Info size={13} />
        <span>Drag from a class edge dot to another class to draw a relationship.</span>
      </div>
    </aside>
  );
}

function ClassNode({ n, selected, onMouseDown, onConnectStart, onDelete }) {
  const meta = TYPE_META[n.type];
  return (
    <div
      className={"uml-node" + (selected ? " is-selected" : "")}
      style={{ left: n.x, top: n.y, width: NODE_W, "--accent": meta.color, "--accent-dim": meta.accent }}
      data-node-id={n.id}
      onMouseDown={onMouseDown}
    >
      <span className="anchor anchor-t" onMouseDown={(e) => { e.stopPropagation(); onConnectStart(e); }} />
      <span className="anchor anchor-r" onMouseDown={(e) => { e.stopPropagation(); onConnectStart(e); }} />
      <span className="anchor anchor-b" onMouseDown={(e) => { e.stopPropagation(); onConnectStart(e); }} />
      <span className="anchor anchor-l" onMouseDown={(e) => { e.stopPropagation(); onConnectStart(e); }} />

      {selected && <button className="node-del" onMouseDown={(e) => e.stopPropagation()} onClick={onDelete} title="Delete class"><Trash2 size={13} /></button>}

      <div className="node-head">
        {meta.stereotype && <div className="node-stereotype">{meta.stereotype}</div>}
        <div className={"node-name" + (n.type === "abstract" ? " italic" : "")}>{n.name}</div>
      </div>

      {n.type === "enum" ? (
        <>
          <div className="node-section values">
            {n.values.map((v) => <div key={v.id} className="enum-pill">{v.name}</div>)}
          </div>
          {(n.attributes.length > 0 || n.methods.length > 0) && (
            <>
              <div className="node-section">
                {n.attributes.map((a) => <div key={a.id} className="row-line"><span className="vis">{VIS_SYMBOL[a.visibility]}</span>{a.name}: {a.type}</div>)}
              </div>
              <div className="node-section">
                {n.methods.map((m) => <div key={m.id} className="row-line"><span className="vis">{VIS_SYMBOL[m.visibility]}</span>{m.name}({m.params}): {m.returnType}</div>)}
              </div>
            </>
          )}
        </>
      ) : n.type === "interface" ? (
        <div className="node-section">
          {n.attributes.map((a) => <div key={a.id} className="row-line"><span className="vis">{VIS_SYMBOL[a.visibility]}</span>{a.name.toUpperCase()}: {a.type}</div>)}
          {n.methods.map((m) => <div key={m.id} className="row-line italic">{m.name}({m.params}): {m.returnType}</div>)}
        </div>
      ) : (
        <>
          <div className="node-section">
            {n.attributes.map((a) => <div key={a.id} className="row-line"><span className="vis">{VIS_SYMBOL[a.visibility]}</span>{a.name}: {a.type}</div>)}
          </div>
          <div className="node-section">
            {n.methods.map((m) => <div key={m.id} className={"row-line" + (m.abstract ? " italic" : "")}><span className="vis">{VIS_SYMBOL[m.visibility]}</span>{m.name}({m.params}): {m.returnType}</div>)}
          </div>
        </>
      )}
    </div>
  );
}

function nodeAnchor(n) { return { x: n.x + NODE_W / 2, y: n.y + 26 }; }

function RelationLine({ r, nodes, selected, onSelect }) {
  const a = nodes.find((n) => n.id === r.from);
  const b = nodes.find((n) => n.id === r.to);
  if (!a || !b) return null;
  const p1 = nodeAnchor(a);
  const p2 = nodeAnchor(b);
  const meta = REL_META[r.type];
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const markerEnd = meta.end === "open" ? "url(#m-open)" : meta.end === "triangle" ? "url(#m-triangle)" : undefined;
  const markerStart = meta.start === "diamondOpen" ? "url(#m-diamondOpen)" : meta.start === "diamondFilled" ? "url(#m-diamondFilled)" : undefined;
  return (
    <g className={"rel-group" + (selected ? " is-selected" : "")} onClick={onSelect}>
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className="rel-hit" />
      <line
        x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
        className="rel-line"
        strokeDasharray={meta.dash ? "7,5" : undefined}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      {r.label && <text x={midX} y={midY - 10} className="rel-label" textAnchor="middle">{r.label}</text>}
      {r.fromCard && <text x={p1.x + (p2.x > p1.x ? 14 : -14)} y={p1.y - 8} className="rel-card" textAnchor={p2.x > p1.x ? "start" : "end"}>{r.fromCard}</text>}
      {r.toCard && <text x={p2.x + (p1.x > p2.x ? 14 : -14)} y={p2.y - 8} className="rel-card" textAnchor={p1.x > p2.x ? "start" : "end"}>{r.toCard}</text>}
    </g>
  );
}

function RelationPopover({ rel, nodes, x, y, onChange, onDelete, onClose }) {
  const from = nodes.find((n) => n.id === rel.from);
  const to = nodes.find((n) => n.id === rel.to);
  const left = Math.min(Math.max(x, 170), (typeof window !== "undefined" ? window.innerWidth : 1200) - 190);
  const top = Math.min(Math.max(y, 90), (typeof window !== "undefined" ? window.innerHeight : 800) - 260);
  return (
    <div className="rel-popover" style={{ left, top }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="rel-popover-head">
        <span>{from ? from.name : "?"} &rarr; {to ? to.name : "?"}</span>
        <button onClick={onClose}><X size={13} /></button>
      </div>
      <label>Type
        <select value={rel.type} onChange={(e) => onChange({ type: e.target.value })}>
          {Object.entries(REL_META).map(([k, m]) => <option key={k} value={k}>{m.label} {m.short}</option>)}
        </select>
      </label>
      <label>Label
        <input value={rel.label} placeholder="e.g. places" onChange={(e) => onChange({ label: e.target.value })} />
      </label>
      <div className="rel-cards">
        <label>From
          <input value={rel.fromCard} placeholder="1" onChange={(e) => onChange({ fromCard: e.target.value })} />
        </label>
        <label>To
          <input value={rel.toCard} placeholder="*" onChange={(e) => onChange({ toCard: e.target.value })} />
        </label>
      </div>
      <button className="rel-delete" onClick={onDelete}><Trash2 size={13} /> Delete relationship</button>
    </div>
  );
}

function ZoomControls({ scale, onIn, onOut, onReset }) {
  return (
    <div className="zoom-controls">
      <button onClick={onOut}><ZoomOut size={15} /></button>
      <span>{Math.round(scale * 100)}%</span>
      <button onClick={onIn}><ZoomIn size={15} /></button>
      <button onClick={onReset} title="Reset view"><Maximize size={14} /></button>
    </div>
  );
}

function Legend({ open, onToggle }) {
  return (
    <div className={"legend" + (open ? " open" : "")}>
      <button className="legend-toggle" onClick={onToggle}>
        <Link2 size={13} /> Relationship key {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      {open && (
        <div className="legend-body">
          {Object.entries(REL_META).map(([k, m]) => (
            <div key={k} className="legend-row"><span className="legend-sym">{m.short}</span>{m.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, count, open, onToggle, children }) {
  return (
    <div className="ins-section">
      <button className="ins-section-head" onClick={onToggle}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <b>{title}</b><span>{count}</span>
      </button>
      {open && <div className="ins-section-body">{children}</div>}
    </div>
  );
}

function Inspector({ node, nodes, relations, openSection, setOpenSection, onNameChange, onDelete, addAttribute, addMethod, addValue, patchAttr, patchMethod, patchValue, removeAttr, removeMethod, removeValue }) {
  if (!node) {
    return (
      <aside className="inspector empty">
        <Compass size={30} />
        <p>Select a class on the canvas to inspect and edit its blueprint.</p>
      </aside>
    );
  }
  const meta = TYPE_META[node.type];
  const toggle = (key) => setOpenSection((s) => ({ ...s, [key]: !s[key] }));
  const relCount = relations.filter((r) => r.from === node.id || r.to === node.id).length;

  return (
    <aside className="inspector">
      <div className="ins-top" style={{ "--accent": meta.color }}>
        <div>
          <small>{meta.label.toUpperCase()}</small>
          <input className="ins-name" value={node.name} onChange={(e) => onNameChange(e.target.value)} />
        </div>
        <button className="ins-del" onClick={onDelete} title="Delete class"><Trash2 size={15} /></button>
      </div>

      {node.type === "enum" && (
        <Section title="Values" count={node.values.length} open={openSection.values} onToggle={() => toggle("values")}>
          {node.values.map((v) => (
            <div className="item-row" key={v.id}>
              <input value={v.name} onChange={(e) => patchValue(v.id, { name: e.target.value.toUpperCase().replace(/\s/g, "_") })} />
              <button onClick={() => removeValue(v.id)}><Trash2 size={13} /></button>
            </div>
          ))}
          <button className="add-item" onClick={addValue}><Plus size={13} /> Add Value</button>
        </Section>
      )}

      {node.type !== "interface" && (
        <Section title={node.type === "enum" ? "Extra Fields (optional)" : "Attributes"} count={node.attributes.length} open={openSection.attrs} onToggle={() => toggle("attrs")}>
          {node.attributes.map((a) => (
            <div className="item-row" key={a.id}>
              <select value={a.visibility} onChange={(e) => patchAttr(a.id, { visibility: e.target.value })}>
                <option value="private">-</option><option value="protected">#</option><option value="public">+</option>
              </select>
              <input value={a.name} onChange={(e) => patchAttr(a.id, { name: e.target.value })} />
              <select value={a.type} onChange={(e) => patchAttr(a.id, { type: e.target.value })}>
                {JAVA_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <button onClick={() => removeAttr(a.id)}><Trash2 size={13} /></button>
            </div>
          ))}
          <button className="add-item" onClick={addAttribute}><Plus size={13} /> Add Attribute</button>
        </Section>
      )}

      {node.type === "interface" && (
        <Section title="Constants" count={node.attributes.length} open={openSection.attrs} onToggle={() => toggle("attrs")}>
          {node.attributes.map((a) => (
            <div className="item-row" key={a.id}>
              <input value={a.name} onChange={(e) => patchAttr(a.id, { name: e.target.value })} />
              <select value={a.type} onChange={(e) => patchAttr(a.id, { type: e.target.value })}>
                {JAVA_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <button onClick={() => removeAttr(a.id)}><Trash2 size={13} /></button>
            </div>
          ))}
          <button className="add-item" onClick={addAttribute}><Plus size={13} /> Add Constant</button>
        </Section>
      )}

      <Section title={node.type === "interface" ? "Method Signatures" : "Methods"} count={node.methods.length} open={openSection.methods} onToggle={() => toggle("methods")}>
        {node.methods.map((m) => (
          <div className="item-col" key={m.id}>
            <div className="item-row">
              {node.type !== "interface" && (
                <select value={m.visibility} onChange={(e) => patchMethod(m.id, { visibility: e.target.value })}>
                  <option value="public">+</option><option value="protected">#</option><option value="private">-</option>
                </select>
              )}
              <input value={m.name} onChange={(e) => patchMethod(m.id, { name: e.target.value })} />
              <select value={m.returnType} onChange={(e) => patchMethod(m.id, { returnType: e.target.value })}>
                {["void", ...JAVA_TYPES].map((t) => <option key={t}>{t}</option>)}
              </select>
              <button onClick={() => removeMethod(m.id)}><Trash2 size={13} /></button>
            </div>
            <input className="params-input" placeholder="Parameters e.g. String name" value={m.params} onChange={(e) => patchMethod(m.id, { params: e.target.value })} />
            {node.type === "abstract" && (
              <label className="abstract-toggle">
                <input type="checkbox" checked={!!m.abstract} onChange={(e) => patchMethod(m.id, { abstract: e.target.checked })} /> abstract (no body)
              </label>
            )}
          </div>
        ))}
        <button className="add-item" onClick={addMethod}><Plus size={13} /> Add Method</button>
      </Section>

      <Section title="Relationships" count={relCount} open={openSection.rels} onToggle={() => toggle("rels")}>
        {relCount === 0 && <div className="rel-empty">Drag from an edge dot on this class to another class to connect them.</div>}
        {relations.filter((r) => r.from === node.id || r.to === node.id).map((r) => {
          const other = nodes.find((n) => n.id === (r.from === node.id ? r.to : r.from));
          return (
            <div className="rel-mini" key={r.id}>
              <span className="rel-mini-sym">{REL_META[r.type].short}</span>
              <span>{other ? other.name : "?"}</span>
              <span className="rel-mini-type">{REL_META[r.type].label}</span>
            </div>
          );
        })}
      </Section>
    </aside>
  );
}

function CodeView({ nodes, relations, onCopy, onDownload }) {
  return (
    <div className="code-view">
      <div className="code-view-head">
        <div>
          <h2>Generated Java Source</h2>
          <p>Live preview, rebuilt automatically from your blueprint.</p>
        </div>
      </div>
      <div className="code-grid">
        {nodes.map((n) => (
          <div className="code-card" key={n.id} style={{ "--accent": TYPE_META[n.type].color }}>
            <div className="code-card-head">
              <span>{n.name}.java</span>
              <div className="code-card-actions">
                <button onClick={() => onCopy(n)} title="Copy"><Copy size={13} /></button>
                <button onClick={() => onDownload(n)} title="Download"><Download size={13} /></button>
              </div>
            </div>
            <pre>{generateJava(n, nodes, relations)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- style --------------------------------- */

function StyleSheet() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

      .uml-root, .uml-root * { box-sizing: border-box; }
      .uml-root {
        --bg: #0A1622;
        --panel: #0E1E30;
        --panel-2: #0C1926;
        --line: #1B3852;
        --grid-minor: #12283B;
        --grid-major: #16324A;
        --text: #E6EDF3;
        --text-dim: #8AA3B8;
        --accent-cyan: #5AC0E8;
        --danger: #E8697D;
        font-family: 'Space Grotesk', -apple-system, sans-serif;
        color: var(--text);
        background: var(--bg);
        width: 100%;
        min-height: 720px;
        height: 100%;
        display: flex;
        flex-direction: column;
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid var(--line);
        position: relative;
      }
      .mono { font-family: 'JetBrains Mono', monospace; }

      .topbar {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 20px; background: linear-gradient(180deg, var(--panel-2), var(--bg));
        border-bottom: 1px solid var(--line);
      }
      .brand { display: flex; align-items: center; gap: 12px; }
      .brand-mark {
        width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
        background: linear-gradient(135deg, var(--accent-cyan), #2A6E8C); color: #06131E;
      }
      .brand-text { display: flex; flex-direction: column; line-height: 1.25; }
      .brand-text b { font-size: 15.5px; letter-spacing: .2px; }
      .brand-text small { color: var(--text-dim); font-size: 11.5px; }
      .top-actions { display: flex; gap: 8px; }
      .top-actions button, .rel-delete {
        display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 8px;
        background: var(--panel); border: 1px solid var(--line); color: var(--text); font-size: 12.5px;
        cursor: pointer; font-family: inherit; transition: border-color .15s, transform .1s;
      }
      .top-actions button:hover { border-color: var(--accent-cyan); }
      .top-actions button:active { transform: translateY(1px); }
      .top-actions .primary { background: linear-gradient(135deg, var(--accent-cyan), #2A87AD); color: #06131E; border: none; font-weight: 600; }

      .tabs-row { display: flex; align-items: center; gap: 6px; padding: 10px 20px; border-bottom: 1px solid var(--line); background: var(--panel-2); }
      .tab {
        display: flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: 8px 8px 0 0;
        background: transparent; border: none; color: var(--text-dim); font-family: inherit; font-size: 13px; cursor: pointer;
        border-bottom: 2px solid transparent;
      }
      .tab.active { color: var(--text); border-bottom: 2px solid var(--accent-cyan); }
      .tabs-spacer { flex: 1; }
      .node-count { font-size: 11.5px; color: var(--text-dim); }
      .node-count span { color: var(--accent-cyan); font-weight: 600; }

      .toast {
        position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
        background: #0E2131; border: 1px solid var(--accent-cyan); color: var(--text);
        padding: 9px 16px; border-radius: 20px; font-size: 12.5px; z-index: 60; box-shadow: 0 10px 30px rgba(0,0,0,.4);
        animation: toastIn .18s ease-out;
      }
      @keyframes toastIn { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }

      .workspace { flex: 1; display: flex; min-height: 0; position: relative; }

      /* palette */
      .palette { width: 190px; background: var(--panel-2); border-right: 1px solid var(--line); padding: 16px 12px; overflow-y: auto; }
      .palette-title { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-dim); margin-bottom: 4px; }
      .palette-hint { font-size: 11px; color: var(--text-dim); margin-bottom: 14px; line-height: 1.4; }
      .palette-item {
        display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 9px; margin-bottom: 8px;
        background: var(--panel); border: 1px solid var(--line); cursor: grab; user-select: none;
        transition: border-color .15s, background .15s;
      }
      .palette-item:hover { border-color: var(--accent); background: #0F2333; }
      .palette-item:active { cursor: grabbing; }
      .palette-icon { color: var(--accent); display: flex; }
      .palette-label { font-size: 12.5px; flex: 1; }
      .palette-grip { color: var(--text-dim); opacity: .5; }
      .palette-divider { height: 1px; background: var(--line); margin: 12px 0; }
      .palette-note { display: flex; gap: 7px; font-size: 11px; color: var(--text-dim); line-height: 1.4; }

      /* canvas */
      .canvas-shell { flex: 1; position: relative; overflow: hidden; cursor: grab; background: var(--bg); }
      .canvas-shell:active { cursor: grabbing; }
      .grid-layer {
        position: absolute; inset: 0;
        background-image:
          linear-gradient(var(--grid-minor) 1px, transparent 1px),
          linear-gradient(90deg, var(--grid-minor) 1px, transparent 1px),
          linear-gradient(var(--grid-major) 1px, transparent 1px),
          linear-gradient(90deg, var(--grid-major) 1px, transparent 1px);
      }
      .content-layer { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
      .rel-svg { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
      .rel-hit { stroke: transparent; stroke-width: 14; pointer-events: stroke; cursor: pointer; }
      .rel-group { pointer-events: auto; }
      .rel-line { stroke: #7FA8C9; stroke-width: 1.6; fill: none; }
      .rel-group.is-selected .rel-line { stroke: var(--accent-cyan); stroke-width: 2.2; }
      .rel-label { fill: #C9DCE9; font-size: 11px; font-family: 'JetBrains Mono', monospace; }
      .rel-card { fill: #8AA3B8; font-size: 10px; font-family: 'JetBrains Mono', monospace; }

      /* node */
      .uml-node {
        position: absolute; background: var(--panel); border: 1.5px solid var(--line); border-radius: 10px;
        box-shadow: 0 6px 18px rgba(0,0,0,.35); user-select: none; cursor: grab;
      }
      .uml-node:active { cursor: grabbing; }
      .uml-node.is-selected { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent), 0 10px 26px rgba(0,0,0,.45); }
      .node-head { padding: 10px 12px 8px; border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--accent) 10%, var(--panel)); border-radius: 9px 9px 0 0; }
      .node-stereotype { font-size: 10px; color: var(--accent); text-align: center; font-family: 'JetBrains Mono', monospace; margin-bottom: 2px; }
      .node-name { font-weight: 600; font-size: 14px; text-align: center; }
      .node-name.italic { font-style: italic; }
      .node-section { padding: 7px 12px; border-bottom: 1px solid var(--line); font-size: 11.5px; font-family: 'JetBrains Mono', monospace; min-height: 12px; }
      .node-section:last-child { border-bottom: none; border-radius: 0 0 9px 9px; }
      .node-section.values { display: flex; flex-wrap: wrap; gap: 5px; padding: 9px 12px; }
      .row-line { padding: 2px 0; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .row-line.italic { font-style: italic; color: var(--text-dim); }
      .vis { color: var(--accent); margin-right: 5px; font-weight: 700; }
      .enum-pill { background: color-mix(in srgb, var(--accent) 18%, var(--panel)); border: 1px solid var(--accent); color: var(--text); border-radius: 6px; padding: 2px 7px; font-size: 10.5px; }

      .anchor { position: absolute; width: 11px; height: 11px; border-radius: 50%; background: var(--accent); border: 2px solid var(--bg); opacity: 0; transition: opacity .15s, transform .15s; cursor: crosshair; z-index: 5; }
      .uml-node:hover .anchor, .uml-node.is-selected .anchor { opacity: 1; }
      .anchor:hover { transform: scale(1.4); }
      .anchor-t { top: -6px; left: calc(50% - 5px); }
      .anchor-b { bottom: -6px; left: calc(50% - 5px); }
      .anchor-l { left: -6px; top: calc(50% - 5px); }
      .anchor-r { right: -6px; top: calc(50% - 5px); }

      .node-del {
        position: absolute; top: -10px; right: -10px; width: 24px; height: 24px; border-radius: 50%;
        background: var(--danger); border: 2px solid var(--bg); color: #fff; display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 6;
      }

      /* zoom + legend */
      .zoom-controls { position: absolute; right: 18px; bottom: 18px; display: flex; align-items: center; gap: 4px; background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 5px; }
      .zoom-controls button { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; color: var(--text); cursor: pointer; border-radius: 6px; }
      .zoom-controls button:hover { background: var(--panel); }
      .zoom-controls span { font-size: 11px; width: 40px; text-align: center; color: var(--text-dim); font-family: 'JetBrains Mono', monospace; }

      .legend { position: absolute; left: 206px; bottom: 18px; background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; font-size: 11.5px; overflow: hidden; }
      .legend-toggle { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: transparent; border: none; color: var(--text-dim); cursor: pointer; font-family: inherit; width: 100%; }
      .legend-body { padding: 0 12px 10px; display: flex; flex-direction: column; gap: 4px; }
      .legend-row { display: flex; align-items: center; gap: 8px; color: var(--text-dim); }
      .legend-sym { width: 34px; color: var(--accent-cyan); font-family: 'JetBrains Mono', monospace; text-align: center; }

      /* relation popover */
      .rel-popover { position: fixed; width: 220px; background: var(--panel); border: 1px solid var(--accent-cyan); border-radius: 10px; padding: 12px; z-index: 80; box-shadow: 0 16px 40px rgba(0,0,0,.5); }
      .rel-popover-head { display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; color: var(--text-dim); margin-bottom: 10px; }
      .rel-popover-head button { background: none; border: none; color: var(--text-dim); cursor: pointer; }
      .rel-popover label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--text-dim); margin-bottom: 8px; }
      .rel-popover input, .rel-popover select {
        background: var(--panel-2); border: 1px solid var(--line); color: var(--text); border-radius: 6px; padding: 6px 8px; font-size: 12px; font-family: inherit;
      }
      .rel-cards { display: flex; gap: 8px; }
      .rel-cards label { flex: 1; }
      .rel-delete { width: 100%; justify-content: center; color: var(--danger); border-color: var(--danger); margin-top: 4px; }

      /* inspector */
      .inspector { width: 300px; background: var(--panel-2); border-left: 1px solid var(--line); overflow-y: auto; padding: 16px; }
      .inspector.empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text-dim); text-align: center; padding: 40px 24px; }
      .inspector.empty svg { color: var(--accent-cyan); opacity: .6; }
      .ins-top { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--line); margin-bottom: 12px; }
      .ins-top small { color: var(--accent); font-size: 10.5px; letter-spacing: .06em; }
      .ins-name { display: block; margin-top: 4px; background: transparent; border: none; border-bottom: 1px solid transparent; color: var(--text); font-size: 18px; font-weight: 600; font-family: inherit; padding: 2px 0; width: 220px; }
      .ins-name:focus { outline: none; border-bottom-color: var(--accent-cyan); }
      .ins-del { background: none; border: 1px solid var(--line); color: var(--danger); border-radius: 8px; width: 30px; height: 30px; cursor: pointer; }

      .ins-section { margin-bottom: 6px; border-bottom: 1px solid var(--line); }
      .ins-section-head { display: flex; align-items: center; gap: 6px; width: 100%; background: none; border: none; color: var(--text); padding: 9px 0; cursor: pointer; font-family: inherit; }
      .ins-section-head b { font-size: 12.5px; font-weight: 600; }
      .ins-section-head span { margin-left: auto; color: var(--text-dim); font-size: 11px; background: var(--panel); border-radius: 10px; padding: 1px 7px; }
      .ins-section-body { padding-bottom: 10px; display: flex; flex-direction: column; gap: 6px; }

      .item-row { display: flex; gap: 5px; align-items: center; }
      .item-row input, .item-row select { background: var(--panel); border: 1px solid var(--line); color: var(--text); border-radius: 6px; padding: 5px 6px; font-size: 11.5px; font-family: 'JetBrains Mono', monospace; }
      .item-row input { flex: 1; min-width: 0; }
      .item-row select { flex-shrink: 0; }
      .item-row button { background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 4px; }
      .item-row button:hover { color: var(--danger); }
      .item-col { display: flex; flex-direction: column; gap: 4px; padding-bottom: 6px; border-bottom: 1px dashed var(--line); }
      .params-input { width: 100%; background: var(--panel); border: 1px solid var(--line); color: var(--text-dim); border-radius: 6px; padding: 5px 7px; font-size: 11px; font-family: 'JetBrains Mono', monospace; }
      .abstract-toggle { display: flex; align-items: center; gap: 6px; font-size: 10.5px; color: var(--text-dim); }
      .add-item { display: flex; align-items: center; gap: 5px; background: none; border: 1px dashed var(--line); color: var(--accent-cyan); border-radius: 6px; padding: 6px 8px; font-size: 11.5px; cursor: pointer; font-family: inherit; justify-content: center; }
      .add-item:hover { border-color: var(--accent-cyan); background: #0F2333; }

      .rel-empty { font-size: 11px; color: var(--text-dim); line-height: 1.4; }
      .rel-mini { display: flex; align-items: center; gap: 8px; font-size: 11.5px; padding: 5px 0; }
      .rel-mini-sym { font-family: 'JetBrains Mono', monospace; color: var(--accent-cyan); width: 30px; }
      .rel-mini-type { margin-left: auto; color: var(--text-dim); font-size: 10.5px; }

      /* code view */
      .code-view { flex: 1; overflow-y: auto; padding: 22px 26px; background: var(--bg); }
      .code-view-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
      .code-view-head h2 { margin: 0 0 4px; font-size: 19px; }
      .code-view-head p { margin: 0; color: var(--text-dim); font-size: 12.5px; }
      .code-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
      .code-card { background: var(--panel); border: 1px solid var(--line); border-top: 3px solid var(--accent); border-radius: 10px; overflow: hidden; }
      .code-card-head { display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; border-bottom: 1px solid var(--line); background: var(--panel-2); font-size: 12px; font-family: 'JetBrains Mono', monospace; }
      .code-card-actions { display: flex; gap: 4px; }
      .code-card-actions button { background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 4px; border-radius: 5px; }
      .code-card-actions button:hover { color: var(--accent-cyan); background: var(--panel); }
      .code-card pre { margin: 0; padding: 14px; font-size: 11.5px; line-height: 1.6; font-family: 'JetBrains Mono', monospace; color: #C9DCE9; overflow-x: auto; max-height: 420px; overflow-y: auto; white-space: pre; }

      @media (max-width: 900px) {
        .palette { display: none; }
        .inspector { width: 260px; }
      }
    `}</style>
  );
}
