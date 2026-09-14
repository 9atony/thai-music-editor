export const resolveToolFeatureId = (toolId) => (
  toolId === 'workspace' || toolId === 'arranger-projects' ? 'arranger' : toolId
);

export const isToolBlockedByMaintenance = ({ toolId, maintenance, role }) => (
  role !== 'admin' && maintenance?.[resolveToolFeatureId(toolId)] === true
);
