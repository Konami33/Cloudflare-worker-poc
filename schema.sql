-- Create labs_sessions table for storing cloud lab state information
-- Each user can have only one active lab at a time

DROP TABLE IF EXISTS labs_sessions;

CREATE TABLE labs_sessions (
    id TEXT PRIMARY KEY,                -- UUID for unique session ID
    labId TEXT NOT NULL,                -- Unique lab identifier
    labTitle TEXT NOT NULL,             -- Title of the lab
    labGroupID TEXT NOT NULL,           -- Associated lab group ID
    moduleID TEXT NOT NULL,             -- Module ID for the lab
    duration INTEGER NOT NULL,          -- Duration in minutes
    activatedAt TEXT NOT NULL,          -- ISO 8601 timestamp when lab was activated
    counterID TEXT NOT NULL,            -- Internal counter ID
    configId TEXT NOT NULL,             -- Config ID for the lab
    workerConfigId TEXT NOT NULL,       -- Config ID specific to worker setup
    lab_request_id TEXT NOT NULL,       -- Unique request ID for the lab
    user_id TEXT NOT NULL UNIQUE,       -- User ID (enforces one active lab per user)
    terminal_url TEXT NOT NULL,         -- URL for the user's terminal
    validation INTEGER NOT NULL,        -- Validation or checksum field
    vscode_domain TEXT,                 -- VS Code instance domain
    puku_domain TEXT,                   -- Puku editor domain
    vm TEXT NOT NULL,                   -- JSON string containing VM information
    worker_nodes TEXT,                  -- JSON string with array of worker node objects
    loadBalancers TEXT,                 -- JSON string with array of load balancer objects
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,  -- Record creation timestamp
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP   -- Record last update timestamp
);

-- Create index on user_id for faster lookups
CREATE INDEX idx_user_id ON labs_sessions(user_id);

-- Create index on lab_request_id for tracking
CREATE INDEX idx_lab_request_id ON labs_sessions(lab_request_id);
