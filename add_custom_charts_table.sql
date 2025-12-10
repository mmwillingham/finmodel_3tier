
CREATE TABLE custom_charts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    chart_type VARCHAR(50) NOT NULL,
    data_sources VARCHAR(255),
    series_configurations TEXT NOT NULL,
    x_axis_label VARCHAR(255),
    y_axis_label VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
