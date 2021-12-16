import { EmojiFilter } from './emoji-filter'

export interface INodeFilter {
  /**
   * Creates a document tree walker filtered to the nodes relevant to the node filter.
   *
   * Examples:
   * 1) An Emoji filter operates on all text nodes.
   * 2) The issue mention filter operates on all text nodes, but not inside pre, code, or anchor tags
   */
  createFilterTreeWalker(doc: Document): TreeWalker

  /**
   * This filter accepts a document node and searches for it's pattern within it.
   *
   * If found, returns an array of nodes to replace the node with.
   *    Example: [Node(contents before match), Node(match replacement), Node(contents after match)]
   * If not found, returns null
   *
   * This is asynchronous as some filters have data must be fetched or, like in
   * emoji, the conversion to base 64 data uri is asynchronous
   * */
  filter(node: Node): Promise<ReadonlyArray<Node> | null>
}

/**
 * Builds an array of node filters to apply to markdown html. Referring to it as pipe
 * because they will be applied in the order they are entered in the returned
 * array. This is important as some filters impact others.
 *
 * @param emoji Map from the emoji shortcut (e.g., :+1:) to the image's local path.
 */
export function buildCustomMarkDownFilterPipe(
  emoji: Map<string, string>
): ReadonlyArray<INodeFilter> {
  return [new EmojiFilter(emoji)]
}

/**
 * Method takes an array of node filters and applies them to a markdown string.
 *
 * It converts the markdown string into a DOM Document. Then, iterates over each
 * provided filter. Each filter will have method to create a tree walker to
 * limit the document nodes relative to the filter's purpose. Then, it will
 * replace any affected node with the node(s) generated by the node filter. If a
 * node is not impacted, it is not replace.
 */
export async function applyNodeFilters(
  nodeFilters: ReadonlyArray<INodeFilter>,
  parsedMarkdown: string
): Promise<string> {
  const mdDoc = new DOMParser().parseFromString(parsedMarkdown, 'text/html')

  for (const nodeFilter of nodeFilters) {
    await applyNodeFilter(nodeFilter, mdDoc)
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/XMLSerializer
  // Note: This will convert html special entities into their html refs ("<"
  // becomes "&lt"); You can't inject html in to the provided DOM document as a
  // string, it must be a node element.
  return new XMLSerializer().serializeToString(mdDoc)
}

/**
 * Method uses a NodeFilter to replace any nodes that match the filters tree
 * walker and filter change criteria.
 *
 * Note: This mutates; it does not return a changed copy of the DOM Document
 * provided.
 */
async function applyNodeFilter(
  nodeFilter: INodeFilter,
  mdDoc: Document
): Promise<void> {
  const walker = nodeFilter.createFilterTreeWalker(mdDoc)

  let textNode = walker.nextNode()
  const replacementMap = new Map<Node, ReadonlyArray<Node>>()
  while (textNode !== null) {
    const replacementNodes = await nodeFilter.filter(textNode)
    if (replacementNodes !== null) {
      replacementMap.set(textNode, replacementNodes)
    }
    textNode = walker.nextNode()
  }

  for (const [toReplace, replacements] of replacementMap.entries()) {
    const { parentElement } = toReplace
    if (parentElement === null) {
      // Shouldn't happen since all the toReplace are at a minimum children of mdDoc
      continue
    }
    parentElement.append(...replacements)
    parentElement.removeChild(toReplace)
  }
}
