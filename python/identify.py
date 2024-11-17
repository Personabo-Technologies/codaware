import re
from collections import Counter
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

def tokenize_code(code):
    tokens = re.findall(r'\w+', code)
    return ' '.join(tokens)  # Return a string for vectorizer

def find_best_match(code_block_content, files):
    code_block_tokens = tokenize_code(code_block_content)
    documents = [code_block_tokens]
    file_names = []

    for file_name, file_content in files.items():
        file_tokens = tokenize_code(file_content)
        documents.append(file_tokens)
        file_names.append(file_name)

    # Compute TF-IDF vectors
    vectorizer = TfidfVectorizer().fit_transform(documents)
    vectors = vectorizer.toarray()

    # Compute Cosine Similarity between code block and each file
    cosine_similarities = cosine_similarity([vectors[0]], vectors[1:])[0]

    # Pair file names with their similarity scores
    similarity_scores = list(zip(file_names, cosine_similarities))

    # Print all the scores
    print("Similarity Scores:")
    for file_name, score in similarity_scores:
        print(f"{file_name}: {score}")

    # Sort files based on similarity score
    similarity_scores.sort(key=lambda x: x[1], reverse=True)

    # Return the best match
    return similarity_scores[0][0]

# Example usage
code_block_content = """
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
    console.log(`Issue ${issue.id} checkbox changed: `, e.target.checked);
    // Implement any additional logic for handling checkbox change here
  };

  return (
    <Draggable draggableId={issue.id.toString()} index={index}>
      {(provided, snapshot) => (
        <Issue
          to={`${match.url}/issues/${issue.id}`}
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
              aria-label={`Mark issue ${issue.id} as completed`}
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
"""
files = {
    'Issue.jsx': """
import React from 'react';
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
          to={`${match.url}/issues/${issue.id}`}
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
""",
    'Board.jsx': """
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
        path={`${match.path}/issues/:issueId`}
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
""",
'Lists.jsx' : """
import React from 'react';
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

    api.optimisticUpdate(`/issues/${issueId}`, {
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
"""
    # Add other files
}

best_match_file = find_best_match(code_block_content, files)
print(f"The code block most likely belongs to: {best_match_file}")
