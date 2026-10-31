<script>
  // One element of a wall's view tree, then its children.
  // - svg, path and circle are static tags, so the SVG namespace is known when
  //   the component compiles (svelte:element only guesses it).
  // - img is a static tag with every attribute the contract allows on it
  //   spelled out: with spread attributes Svelte writes inline onload and
  //   onerror handlers into server HTML, and a void svelte:element skips
  //   hydration of its attributes.
  // - style is a svelte:element: a literal style tag in a template is CSS for
  //   the compiler, not an element holding text from a variable.
  // - The template holds no whitespace: a space between two tags would be a
  //   visible space inside a badge. Never reformat this file.
  import { styleText } from "../dist/index.js";
  import Node from "./Node.svelte";

  /** @type {{ node: import("../dist/index.js").ViewNode }} */
  let { node } = $props();

  /**
   * An element's attributes as an object, its style as text.
   * @param {import("../dist/index.js").ViewNode} element
   * @returns {Record<string, string>}
   */
  function attributes(element) {
    /** @type {Record<string, string>} */
    const result = {};
    for (const [name, value] of element.attrs) result[name] = value;
    if (element.style !== undefined && element.style.length > 0) {
      result["style"] = styleText(element.style);
    }
    return result;
  }
</script>
{#if node.tag === "svg"}<svg {...attributes(node)}>{#each node.children as child}{#if typeof child !== "string" && child.tag === "path"}<path {...attributes(child)}></path>{:else if typeof child !== "string" && child.tag === "circle"}<circle {...attributes(child)}></circle>{/if}{/each}</svg>{:else if node.tag === "img"}{@const a = attributes(node)}<img src={a.src} alt={a.alt} title={a.title} width={a.width} height={a.height} loading={a.loading} target={a.target} rel={a.rel} viewBox={a.viewBox} fill={a.fill} stroke={a.stroke} stroke-width={a["stroke-width"]} stroke-linecap={a["stroke-linecap"]} stroke-linejoin={a["stroke-linejoin"]} d={a.d} cx={a.cx} cy={a.cy} r={a.r} data-sbm-ref={a["data-sbm-ref"]} data-badge-ref={a["data-badge-ref"]} aria-label={a["aria-label"]} aria-hidden={a["aria-hidden"]} style={a.style} />{:else if node.tag === "style"}<svelte:element this={node.tag} {...attributes(node)}>{node.children.join("")}</svelte:element>{:else}<svelte:element this={node.tag} {...attributes(node)}>{#each node.children as child}{#if typeof child === "string"}{child}{:else}<Node node={child} />{/if}{/each}</svelte:element>{/if}
