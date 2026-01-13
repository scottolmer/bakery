// Sidebar Navigation JavaScript

document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const menuLinks = document.querySelectorAll('.menu-link');

    // Load saved sidebar state
    const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (sidebarCollapsed) {
        sidebar.classList.add('collapsed');
    }

    // Toggle sidebar collapse/expand
    toggleBtn.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');

        // Close any open submenus when collapsing
        if (sidebar.classList.contains('collapsed')) {
            closeAllSubmenus();
        }

        // Save state
        localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    });

    // Handle menu item clicks
    menuLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const submenuId = this.getAttribute('data-submenu');

            if (submenuId) {
                e.preventDefault();

                // If sidebar is collapsed, expand it first
                if (sidebar.classList.contains('collapsed')) {
                    sidebar.classList.remove('collapsed');
                    localStorage.setItem('sidebarCollapsed', 'false');
                }

                toggleSubmenu(submenuId);
            } else {
                // Regular link - set as active
                setActiveLink(this);
            }
        });
    });

    // Set active link based on current page
    setActiveLinkFromURL();

    // Close submenu when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.sidebar') && !e.target.closest('.submenu-panel')) {
            closeAllSubmenus();
        }
    });
});

function toggleSubmenu(submenuId) {
    const submenuPanel = document.getElementById('submenu-' + submenuId);
    const allSubmenus = document.querySelectorAll('.submenu-panel');

    // Close all other submenus
    allSubmenus.forEach(panel => {
        if (panel.id !== 'submenu-' + submenuId) {
            panel.classList.remove('active');
        }
    });

    // Toggle the clicked submenu
    if (submenuPanel) {
        submenuPanel.classList.toggle('active');
    }
}

function closeAllSubmenus() {
    const allSubmenus = document.querySelectorAll('.submenu-panel');
    allSubmenus.forEach(panel => {
        panel.classList.remove('active');
    });
}

function setActiveLink(link) {
    // Remove active class from all links
    document.querySelectorAll('.menu-link').forEach(l => {
        l.classList.remove('active');
    });

    // Add active class to clicked link
    link.classList.add('active');
}

function setActiveLinkFromURL() {
    const currentPath = window.location.pathname;
    const menuLinks = document.querySelectorAll('.menu-link');

    menuLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href !== '#' && currentPath === href) {
            link.classList.add('active');
        }
    });

    // Also check submenu links
    const submenuLinks = document.querySelectorAll('.submenu-list a');
    submenuLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && currentPath === href) {
            link.style.background = '#f5f5f5';
            link.style.fontWeight = '600';

            // Open the parent submenu
            const submenuPanel = link.closest('.submenu-panel');
            if (submenuPanel) {
                submenuPanel.classList.add('active');

                // Also highlight the parent menu item
                const submenuId = submenuPanel.id.replace('submenu-', '');
                const parentLink = document.querySelector(`[data-submenu="${submenuId}"]`);
                if (parentLink) {
                    parentLink.classList.add('active');
                }
            }
        }
    });
}
