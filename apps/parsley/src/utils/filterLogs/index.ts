import SkippedLinesRow from "components/LogRow/SkippedLinesRow";
import { log } from "console";
import { SectionState } from "hooks/useSections";
import { CommandEntry, SectionData } from "hooks/useSections/utils";
import {
  ExpandedLines,
  ProcessedLogLines,
  RowType,
  SubsectionHeaderRow,
} from "types/logs";
import { isExpanded } from "utils/expandedLines";
import { newSkippedLinesRow } from "utils/logRow";
import { isSectionHeaderRow, isSkippedLinesRow, isSubsectionHeaderRow } from "utils/logRowTypes";

type FilterLogsParams = {
  logLines: string[];
  matchingLines: Set<number> | undefined;
  bookmarks: number[];
  shareLine: number | undefined;
  expandedLines: ExpandedLines;
  expandableRows: boolean;
  failingLine: number | undefined;
  sectionData: SectionData | undefined;
  sectioningEnabled: boolean;
  sectionState: SectionState | undefined;
};

/**
 * getProccessedCommandLine returns a processed command
 * line and is a helper function for filterLogs.
 * @param command A command entry object from the section data.
 * @param sectionState The state of the sections.
 * @returns A processed line object to be inserted in ProcessedLogLines.
 */
const getProccessedCommandLine = (
  command: CommandEntry,
  sectionState: SectionState,
): SubsectionHeaderRow => {
  const isOpen =
    sectionState[command.functionID].commands[command.commandID]?.isOpen;
  return {
    ...command,
    isOpen,
    rowType: RowType.SubsectionHeader,
  };
};
/**
 * `filterLogs` processes log lines according to what filters, bookmarks, share line, and expanded lines are applied.
 * @param options - an object containing the parameters
 * @param options.bookmarks - list of line numbers representing bookmarks
 * @param options.expandableRows - specifies if expandable rows is enabled
 * @param options.expandedLines - an array of intervals representing expanded ranges
 * @param options.failingLine - a line number representing the failing line
 * @param options.logLines - list of strings representing the log lines
 * @param options.matchingLines - set of numbers representing which lines match the applied filters
 * @param options.sectionData - an array of objects representing the sections
 * @param options.sectioningEnabled - specifies if sections are enabled
 * @param options.sectionState - specifies which sections are open or closed
 * @param options.shareLine - a line number representing a share line
 * @returns an array of numbers that indicates which log lines should be displayed, and which log lines
 * should be collapsed
 */
const filterLogs = (options: FilterLogsParams): ProcessedLogLines => {
  const {
    bookmarks,
    expandableRows,
    expandedLines,
    failingLine,
    logLines,
    matchingLines,
    sectionData,
    sectionState,
    sectioningEnabled,
    shareLine,
  } = options;
  console.log(sectionState)
  // If there are no filters or expandable rows is not enabled, then we only have to process sections if they exist and are enabled.
  if (matchingLines === undefined) {
    if (sectioningEnabled && sectionData?.functions.length && sectionState) {
      const filteredLines: ProcessedLogLines = [];
      let funcIndex = 0;
      let commandIndex = 0;
      for (let idx = 0; idx < logLines.length; idx++) {
        const func = sectionData.functions[funcIndex];
        const isFuncStart = func && idx === func.range.start;
        const isFuncOpen = sectionState[func?.functionID]?.isOpen ?? false;

        const command = sectionData.commands[commandIndex];
        const isCommandStart = command && idx === command.range.start;

        if (isFuncStart) {
          // A function start is detected.
          filteredLines.push({
            ...func,
            isOpen: isFuncOpen,
            rowType: RowType.SectionHeader,
          });
          funcIndex += 1;
          if (!isFuncOpen) {
            // The function is closed. Skip all log lines until the end of the function.
            idx = func.range.end - 1;
            // Skip all commands until the end of the function.
            while (
              sectionData.commands[commandIndex] &&
              sectionData.commands[commandIndex].functionID === func.functionID
            ) {
              commandIndex += 1;
            }
          }
        }
        if (isCommandStart && ((isFuncStart && isFuncOpen) || !isFuncStart)) {
          // A command start is detected.
          const commandLine = getProccessedCommandLine(command, sectionState);
          filteredLines.push(commandLine);
          if (commandLine.isOpen) {
            filteredLines.push(idx);
          } else {
            idx = command.range.end - 1;
          }
          commandIndex += 1;
        }
        if (!isFuncStart && !isCommandStart) {
          filteredLines.push(idx);
        }
      }
      return filteredLines;
    }
    return logLines.map((_, idx) => idx);
  }

  let filteredLines: ProcessedLogLines = [];
  let funcIndex = 0;
  let commandIndex = 0;
  logLines.reduce((arr, _logLine, idx) => {
    if(sectioningEnabled && sectionData?.functions.length && sectionState) {
    const func = sectionData?.functions[funcIndex];
    const isFuncStart = func && idx === func.range.start;

    const command = sectionData?.commands[commandIndex];
    const isCommandStart = command && idx === command.range.start;
    if(isFuncStart) {
      filteredLines.push({
        ...func,
        isOpen: true,
        rowType: RowType.SectionHeader,
      }); 
      funcIndex += 1;
    }
    // comment this out to omit subsections
    if(isCommandStart) {
      filteredLines.push({
        ...command,
        isOpen: true,
        rowType: RowType.SubsectionHeader,
      });
      commandIndex += 1;
    }
  }
    // Bookmarks, expanded lines, and the share line should always remain uncollapsed.
    if (
      bookmarks.includes(idx) ||
      shareLine === idx ||
      failingLine === idx ||
      isExpanded(idx, expandedLines)
    ) {
      arr.push(idx);
      return arr;
    }

    // If the line matches the filters, it should remain uncollapsed.
    if (matchingLines.has(idx)) {
      arr.push(idx);
      return arr;
    }

    if (expandableRows) {
      // If the line doesn't match the filters, collapse it.
      const previousItem = arr[arr.length - 1];
      if (isSkippedLinesRow(previousItem)) {
        previousItem.range.end = idx + 1;
      } else {
        arr.push(newSkippedLinesRow(idx, idx + 1));
      }
    }
    return arr;
  }, filteredLines);

  // comment this out to make all sections open
  if(sectioningEnabled && sectionData?.functions.length && sectionState) {
  const res:ProcessedLogLines = [];
  for (let idx = 0; idx < filteredLines.length; idx++) {
    const line = filteredLines[idx];
    res.push(line);
    if(isSectionHeaderRow(line)) {
     let hasMatch = false
     let i = idx + 1
      for( i ; !isSectionHeaderRow(filteredLines[i]) && i < filteredLines.length; i++) {
        if(typeof filteredLines[i] === 'number') {
          hasMatch = true
          console.log('hasMatch', hasMatch)
        }
      }
      if(!hasMatch) {
        line.isOpen = false
        idx = i - 1
      }
    }
  }
  filteredLines = res
}
return filteredLines
};


export default filterLogs;
