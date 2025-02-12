import { remark } from "remark";
import remarkFrontmatter from "remark-frontmatter";
import { v4 as uuid } from "uuid";

export function parseMarkdown(content) {
  const tree = remark().use(remarkFrontmatter).parse(content);
  let currentSection = null;

  const result = {
    frontmatter: [],
    sections: [],
  };

  const updateParentPositions = (section, endPosition) => {
    if (!section || !endPosition) return;

    // Ensure position object exists
    if (!section.position) {
      section.position = {
        start: { line: 0, column: 0, offset: 0 },
        end: { line: 0, column: 0, offset: 0 },
      };
    }

    // Update section's end position if the new end position is greater
    if (section.position.end.offset < endPosition.offset) {
      section.position.end = { ...endPosition };
    }

    // Find and update parent's position
    const parent = findParent(result, section.id);
    if (parent && parent.position) {
      updateParentPositions(parent, endPosition);
    }
  };

  /**
   * Adds a node to a section's content sequence based on the specified type.
   * If the last element in the section's content is not of the specified type,
   * a new sequence node is created and added to the content. Otherwise, the node
   * is appended to the existing sequence of the same type.
   *
   * @param {Object} section - The section object containing the content array.
   * @param {string} type - The type of the node to be added.
   * @param {Object} node - The node to be added to the section's content.
   */
  const addToSequence = (section, type, node) => {
    if (
      section.content.length > 0 &&
      Object.hasOwn(section.content[section.content.length - 1], type)
    ) {
      section.content[section.content.length - 1][type].push(node);
      section.content[section.content.length - 1].position.end =
        node.position.end;
    } else {
      const sequenceNode = {
        heading: section.heading,
        position: node.position,
      };
      sequenceNode[type] = [node];
      section.content.push(sequenceNode);
    }
  };

  const processSection = (node) => {
    const newSection = {
      id: uuid(),
      position: node.position,
      content: [],
      rawContent: getNodeRawContent(node),
      heading: {
        level: node.depth,
        position: node.position,
        content: node.children.map((child) => child.value).join(""),
      },
      paragraphs: [],
      codeBlocks: [],
      lists: [],
      sections: [],
    };
    return newSection;
  };

  const processParagraph = (node) => {
    const result = {
      content: node.children.map((child) => child.value).join(""),
      position: node.position,
    };
    return result;
  };

  const processCodeBlock = (node) => {
    const result = {
      content: `\`\`\`${node.lang}\n${node.value}\`\`\``,
      position: node.position,
    };
    return result;
  };

  const processList = (node) => {
    const result = {
      ordered: node.ordered,
      items: node.children.map((item) => {
        if (item.type === "listItem") {
          return {
            position: item.position,
            content: item.children.map((child) => {
              switch (child.type) {
                case "paragraph":
                  return processParagraph(child);
                case "code":
                  return processCodeBlock(child);
                case "list":
                  return processList(child);
                default:
                  return {
                    position: child.position,
                    content: child.value || "",
                  };
              }
            }),
          };
        }
      }),
      position: node.position,
    };
    return result;
  };

  const createDefaultSection = (node) => {
    return {
      id: uuid(),
      position: node.position,
      content: [],
      rawContent: getNodeRawContent(node),
      heading: {
        level: 0,
        position: null,
        content: null,
      },
      paragraphs: [],
      codeBlocks: [],
      lists: [],
      sections: [],
    };
  };

const getNodeRawContent = (node) => {
  if (!node || !node.type) return '';
  switch (node.type) {
    case 'heading':
      return `${'#'.repeat(node.depth)} ${node.children?.map(child => child.value || '').join('') || ''}\n`;
    case 'paragraph':
      return `${node.children?.map(child => child.value || '').join('') || ''}\n`;
    case 'code':
      return `\`\`\`${node.lang || ''}\n${node.value || ''}\n\`\`\`\n`;
    case 'list':
      return node.children.map((item, index) => {
        const prefix = node.ordered ? `${index + 1}. ` : '- ';
        return prefix + item.children.map(child => {
          switch(child.type) {
            case 'paragraph':
              return child.children?.map(c => c.value || '').join('') || '';
            case 'code':
              return getNodeRawContent(child);
            case 'list':
              return getNodeRawContent(child);
            default:
              return child.value || '';
          }
        }).join('\n');
      }).join('\n') + '\n';
    default:
      return '';
  }
};

  const processNode = (node, parentSection) => {
    if (!currentSection && node.type !== "yaml" && node.type !== "heading" && node.type !== "root") {
      currentSection = createDefaultSection(node);
      result.sections.push(currentSection);
    }

    if (node.type === "yaml") {
      const items = node.value
        .trim()
        .split("\n")
        .map((item) => {
          const parts = item.split(":");
          return {
            key: parts[0].trim(),
            value: parts.slice(1).join(":").trim(),
          };
        });
      result.frontmatter = items;
    } else if (node.type === "heading") {
      // Ensure result has a position object before creating new section
      const newSection = processSection(node);

      // Update parent section's end position
      if (parentSection) {
        updateParentPositions(parentSection, node.position.end);
      }

      if (node.depth === 1) {
        result.sections.push(newSection);
      } else if (currentSection && node.depth > currentSection.heading.level) {
        currentSection.sections.push(newSection);
      } else if (currentSection && node.depth <= currentSection.heading.level) {
        let parent = findParent(result, currentSection.id);
        while (parent && node.depth <= parent.heading.level) {
          parent = findParent(result, parent.id);
        }
        if (parent) {
          parent.sections.push(newSection);
        }
      }

      currentSection = newSection;
    } else if (node.type === "paragraph") {
      const paragraph = processParagraph(node);
      addToSequence(currentSection, "paragraphs", paragraph);
      currentSection.paragraphs.push(paragraph);
      currentSection.rawContent += '\n' + getNodeRawContent(node);
      updateParentPositions(parentSection, node.position.end);
      } else if (node.type === "code") {
      const codeBlock = processCodeBlock(node);
      addToSequence(currentSection, "code_blocks", codeBlock);
      currentSection.codeBlocks.push(codeBlock);
      currentSection.rawContent += '\n' + getNodeRawContent(node);
      updateParentPositions(parentSection, node.position.end);
      } else if (node.type === "list") {
      const list = processList(node);
      addToSequence(currentSection, "lists", list);
      currentSection.lists.push(list);
      currentSection.rawContent += '\n' + getNodeRawContent(node);
      updateParentPositions(parentSection, node.position.end);
      }


    if (node.children && node.type !== "list") {
      node.children.forEach((child) => processNode(child, currentSection));
    }
  };

  processNode(tree, null);

  return result;
}

// Function to find immediate parent of an object with given ID
function findParent(obj, targetId, parent = null) {
  // If current object has the target ID, return its parent
  if (obj.id === targetId) {
    return parent;
  }

  // If object has sections, search through them
  if (obj.sections && Array.isArray(obj.sections)) {
    for (const section of obj.sections) {
      const result = findParent(section, targetId, obj);
      if (result !== null) {
        return result;
      }
    }
  }

  return null;
}
