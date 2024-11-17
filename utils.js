const natural = require('natural'); // For tokenization and cosine similarity
const TfIdf = natural.TfIdf;

/**
 * Tokenizes code into alphanumeric tokens.
 * @param {string} code - The code content to tokenize.
 * @returns {string} - A single string of tokens.
 */
function tokenizeCode(code) {
  return code.match(/\w+/g).join(' ');
}

/**
 * Finds the best match for a code block among a set of files based on cosine similarity.
 * @param {string} codeBlockContent - The content of the code block.
 * @param {Object} files - An object containing file names as keys and file contents as values.
 * @returns {string} - The file name with the highest similarity score.
 */
function findBestMatch(codeBlockContent, files) {
    const codeBlockTokens = tokenizeCode(codeBlockContent);
    const tfidf = new TfIdf();
  
    // Add each file's content as a document with a key
    const fileNames = Object.keys(files);
    fileNames.forEach((fileName) => {
      const fileTokens = tokenizeCode(files[fileName]);
      tfidf.addDocument(fileTokens, fileName); // Assign fileName as the document key
    });
  
    // Array to store similarity scores
    const similarityScores = [];
  
    // Compute TF-IDF scores
    tfidf.tfidfs(codeBlockTokens, (i, measure, key) => {
      similarityScores.push({ fileName: key, score: measure });
    });
  
    // Print all scores
    console.log("Similarity Scores:");
    similarityScores.forEach(({ fileName, score }) =>
      console.log(`${fileName}: ${score}`)
    );
  
    // Find the file with the highest similarity score
    const bestMatch = similarityScores.reduce((best, current) =>
      current.score > best.score ? current : best
    );
  
    return bestMatch.fileName;
  }

// Example Usage
const codeBlockContent = `
import React from 'react';
import PropTypes from 'prop-types';
import { useRouteMatch } from 'react-router-dom';
import { Draggable } from 'react-beautiful-dnd';

import { IssueTypeIcon, IssuePriorityIcon } from 'shared/components';

import { IssueLink, Issue, Title, Bottom, Assignees, AssigneeAvatar, Checkbox } from './Styles';

const propTypes = {
  projectUsers: PropTypes.array.isRequired,
  issue: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
};

const ProjectBoardListIssue = ({ projectUsers, issue, index }) => {
  const match = useRouteMatch();

  const assignees = issue.userIds.map(userId => projectUsers.find(user => user.id === userId));

  // Handler for checkbox change
  const handleCheckboxChange = (e) => {
    console.log(\`Issue \${issue.id} checkbox changed: \`, e.target.checked);
    // Implement any additional logic for handling checkbox change here
  };

  return (
    <Draggable draggableId={issue.id.toString()} index={index}>
      {(provided, snapshot) => (
        <Issue
          to={\`\${match.url}/issues/\${issue.id}\`}
          ref={provided.innerRef}
          data-testid="list-issue"
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          {/* Checkbox */}
          <Checkbox>
            <input
              type="checkbox"
              onChange={handleCheckboxChange}
              aria-label={\`Mark issue \${issue.id} as completed\`}
            />
          </Checkbox>

          {/* Issue content */}
          <div>
            <Title>{issue.title}</Title>
            <Bottom>
              <div>
                {assignees.map(user => (
                  <AssigneeAvatar
                    key={user.id}
                    size={24}
                    avatarUrl={user.avatarUrl}
                    name={user.name}
                  />
                ))}
              </div>
            </Bottom>
          </div>
        </Issue>
      )}
    </Draggable>
  );
};

ProjectBoardListIssue.propTypes = propTypes;

export default ProjectBoardListIssue;
`;

const files = {
  "Issue.jsx": `import React from 'react';
import PropTypes from 'prop-types';
import { useRouteMatch } from 'react-router-dom';
import { Draggable } from 'react-beautiful-dnd';

import { IssueTypeIcon, IssuePriorityIcon } from 'shared/components';

import { IssueLink, Issue, Title, Bottom, Assignees, AssigneeAvatar } from './Styles';

const propTypes = {
  projectUsers: PropTypes.array.isRequired,
  issue: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
};

const ProjectBoardListIssue = ({ projectUsers, issue, index }) => {
  const match = useRouteMatch();

  const assignees = issue.userIds.map(userId => projectUsers.find(user => user.id === userId));

  return (
    <Draggable draggableId={issue.id.toString()} index={index}>
      {(provided, snapshot) => (
        <IssueLink
          to={\`\${match.url}/issues/\${issue.id}\`}
          ref={provided.innerRef}
          data-testid="list-issue"
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <Issue isBeingDragged={snapshot.isDragging && !snapshot.isDropAnimating}>
            <Title>{issue.title}</Title>
            <Bottom>
              <div>
                <IssueTypeIcon type={issue.type} />
                <IssuePriorityIcon priority={issue.priority} top={-1} left={4} />
              </div>
              <Assignees>
                {assignees.map(user => (
                  <AssigneeAvatar
                    key={user.id}
                    size={24}
                    avatarUrl={user.avatarUrl}
                    name={user.name}
                  />
                ))}
              </Assignees>
            </Bottom>
          </Issue>
        </IssueLink>
      )}
    </Draggable>
  );
};

ProjectBoardListIssue.propTypes = propTypes;

export default ProjectBoardListIssue;
`, // Add file content here
  "Board.jsx": `
  import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Route, useRouteMatch, useHistory } from 'react-router-dom';

import useMergeState from 'shared/hooks/mergeState';
import { Breadcrumbs, Modal } from 'shared/components';

import Header from './Header';
import Filters from './Filters';
import Lists from './Lists/Lists';
import IssueDetails from './IssueDetails';

const propTypes = {
  project: PropTypes.object.isRequired,
  fetchProject: PropTypes.func.isRequired,
  updateLocalProjectIssues: PropTypes.func.isRequired,
};

const defaultFilters = {
  searchTerm: '',
  userIds: [],
  myOnly: false,
  recent: false,
};

const ProjectBoard = ({ project, fetchProject, updateLocalProjectIssues }) => {
  const match = useRouteMatch();
  const history = useHistory();

  const [filters, mergeFilters] = useMergeState(defaultFilters);

  return (
    <Fragment>
      <Breadcrumbs items={['Projects', project.name, 'Kanban Board']} />
      <Header />
      <Filters
        projectUsers={project.users}
        defaultFilters={defaultFilters}
        filters={filters}
        mergeFilters={mergeFilters}
      />
      <Lists
        project={project}
        filters={filters}
        updateLocalProjectIssues={updateLocalProjectIssues}
      />
      <Route
        path={\`\${match.path}/issues/:issueId\`}
        render={routeProps => (
          <Modal
            isOpen
            testid="modal:issue-details"
            width={1040}
            withCloseIcon={false}
            onClose={() => history.push(match.url)}
            renderContent={modal => (
              <IssueDetails
                issueId={routeProps.match.params.issueId}
                projectUsers={project.users}
                fetchProject={fetchProject}
                updateLocalProjectIssues={updateLocalProjectIssues}
                modalClose={modal.close}
              />
            )}
          />
        )}
      />
    </Fragment>
  );
};

ProjectBoard.propTypes = propTypes;

export default ProjectBoard;
`, // Add file content here
  "Lists.jsx": `import React from 'react';
import PropTypes from 'prop-types';
import { DragDropContext } from 'react-beautiful-dnd';

import useCurrentUser from 'shared/hooks/currentUser';
import api from 'shared/utils/api';
import { moveItemWithinArray, insertItemIntoArray } from 'shared/utils/javascript';
import { IssueStatus } from 'shared/constants/issues';

import List from './List/List';
import { Lists } from './Styles';

const propTypes = {
  project: PropTypes.object.isRequired,
  filters: PropTypes.object.isRequired,
  updateLocalProjectIssues: PropTypes.func.isRequired,
};

const ProjectBoardLists = ({ project, filters, updateLocalProjectIssues }) => {
  const { currentUserId } = useCurrentUser();

  const handleIssueDrop = ({ draggableId, destination, source }) => {
    if (!isPositionChanged(source, destination)) return;

    const issueId = Number(draggableId);

    api.optimisticUpdate(\`/issues/\${issueId}\`, {
      updatedFields: {
        status: destination.droppableId,
        listPosition: calculateIssueListPosition(project.issues, destination, source, issueId),
      },
      currentFields: project.issues.find(({ id }) => id === issueId),
      setLocalData: fields => updateLocalProjectIssues(issueId, fields),
    });
  };

  return (
    <DragDropContext onDragEnd={handleIssueDrop}>
      <Lists>
        {Object.values(IssueStatus).map(status => (
          <List
            key={status}
            status={status}
            project={project}
            filters={filters}
            currentUserId={currentUserId}
          />
        ))}
      </Lists>
    </DragDropContext>
  );
};

const isPositionChanged = (destination, source) => {
  if (!destination) return false;
  const isSameList = destination.droppableId === source.droppableId;
  const isSamePosition = destination.index === source.index;
  return !isSameList || !isSamePosition;
};

const calculateIssueListPosition = (...args) => {
  const { prevIssue, nextIssue } = getAfterDropPrevNextIssue(...args);
  let position;

  if (!prevIssue && !nextIssue) {
    position = 1;
  } else if (!prevIssue) {
    position = nextIssue.listPosition - 1;
  } else if (!nextIssue) {
    position = prevIssue.listPosition + 1;
  } else {
    position = prevIssue.listPosition + (nextIssue.listPosition - prevIssue.listPosition) / 2;
  }
  return position;
};

const getAfterDropPrevNextIssue = (allIssues, destination, source, droppedIssueId) => {
  const beforeDropDestinationIssues = getSortedListIssues(allIssues, destination.droppableId);
  const droppedIssue = allIssues.find(issue => issue.id === droppedIssueId);
  const isSameList = destination.droppableId === source.droppableId;

  const afterDropDestinationIssues = isSameList
    ? moveItemWithinArray(beforeDropDestinationIssues, droppedIssue, destination.index)
    : insertItemIntoArray(beforeDropDestinationIssues, droppedIssue, destination.index);

  return {
    prevIssue: afterDropDestinationIssues[destination.index - 1],
    nextIssue: afterDropDestinationIssues[destination.index + 1],
  };
};

const getSortedListIssues = (issues, status) =>
  issues.filter(issue => issue.status === status).sort((a, b) => a.listPosition - b.listPosition);

ProjectBoardLists.propTypes = propTypes;

export default ProjectBoardLists;
`, // Add file content here
};

// Example Usage
const bestMatch = findBestMatch(codeBlockContent, files);
console.log(`The code block most likely belongs to: ${bestMatch}`);