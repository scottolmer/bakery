// Production Issues Log JavaScript

let issues = [];

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    loadIssues();

    // Set up form handler
    document.getElementById('issue-form').addEventListener('submit', handleIssueSubmit);

    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('issue-date').value = today;
});

async function loadIssues() {
    try {
        const response = await fetch('/api/issues');
        issues = await response.json();
        displayIssues();
    } catch (error) {
        console.error('Error loading issues:', error);
        showError('Failed to load issues');
    }
}

function displayIssues() {
    const container = document.getElementById('issues-list');

    if (issues.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No issues logged yet.</p>';
        return;
    }

    // Sort by date (most recent first), then by severity
    const severityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
    issues.sort((a, b) => {
        const dateCompare = new Date(b.date) - new Date(a.date);
        if (dateCompare !== 0) return dateCompare;
        return severityOrder[a.severity] - severityOrder[b.severity];
    });

    let html = '';
    issues.forEach(issue => {
        const isResolved = issue.resolved_at !== null;
        const resolvedClass = isResolved ? ' resolved' : '';
        const severityClass = `severity-${issue.severity}`;

        // Format date
        const issueDate = new Date(issue.date);
        const formattedDate = issueDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        html += `
            <div class="issue-card ${severityClass}${resolvedClass}">
                <div class="issue-header">
                    <h3 class="issue-title">${issue.title}</h3>
                    <div>
                        <span class="severity-badge ${severityClass}">${issue.severity}</span>
                    </div>
                </div>

                <div class="issue-meta">
                    <span><strong>Date:</strong> ${formattedDate}</span>
                    <span><strong>Type:</strong> ${issue.issue_type}</span>
                    ${issue.reported_by ? `<span><strong>Reported by:</strong> ${issue.reported_by}</span>` : ''}
                </div>

                <div class="issue-description">
                    ${issue.description}
                </div>

                ${issue.affected_items ? `
                    <div class="issue-affected">
                        <strong>Affected Items:</strong> ${issue.affected_items}
                    </div>
                ` : ''}

                ${issue.resolution ? `
                    <div class="issue-resolution" style="margin-top: 1rem; padding: 0.75rem; background: #d4edda; border-left: 3px solid #2ecc71; border-radius: 4px;">
                        <strong style="color: #155724;">Resolution:</strong>
                        <p style="margin: 0.5rem 0 0 0; color: #155724;">${issue.resolution}</p>
                        ${issue.resolved_at ? `
                            <small style="color: #155724; font-size: 0.85rem;">
                                Resolved: ${new Date(issue.resolved_at).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                })}
                            </small>
                        ` : ''}
                    </div>
                ` : ''}

                <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                    ${!isResolved ? `
                        <button class="btn btn-primary" onclick="resolveIssue(${issue.id})" style="background-color: #2ecc71; padding: 0.5rem 1rem;">
                            Mark as Resolved
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

async function handleIssueSubmit(e) {
    e.preventDefault();

    const issueData = {
        date: document.getElementById('issue-date').value,
        issue_type: document.getElementById('issue-type').value,
        severity: document.getElementById('issue-severity').value,
        title: document.getElementById('issue-title').value,
        description: document.getElementById('issue-description').value,
        affected_items: document.getElementById('issue-affected-items').value,
        reported_by: document.getElementById('issue-reported-by').value
    };

    try {
        const response = await fetch('/api/issues', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(issueData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            showError(errorData.error || 'Error logging issue');
            return;
        }

        showSuccess('Issue logged successfully!');

        // Reset form but keep today's date
        document.getElementById('issue-form').reset();
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('issue-date').value = today;

        // Reload issues list
        loadIssues();

    } catch (error) {
        console.error('Error:', error);
        showError('Failed to log issue');
    }
}

async function resolveIssue(issueId) {
    const resolution = prompt('Enter resolution details:');

    if (!resolution || resolution.trim() === '') {
        return;
    }

    try {
        const response = await fetch(`/api/issues/${issueId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                resolution: resolution,
                resolved_at: new Date().toISOString()
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            showError(errorData.error || 'Error resolving issue');
            return;
        }

        showSuccess('Issue marked as resolved!');
        loadIssues();

    } catch (error) {
        console.error('Error:', error);
        showError('Failed to resolve issue');
    }
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    successDiv.textContent = message;
    successDiv.style.display = 'block';

    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 3000);
}
