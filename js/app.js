// Main application entry point
document.addEventListener('DOMContentLoaded', () => {
    console.log('App initialized');
    
    // Check if we're on the course selection page or a quiz page
    if (document.querySelector('.course-selection')) {
        initCourseSelection();
    } else if (document.querySelector('.quiz-container')) {
        // The quiz initialization will be handled by the course-specific JS
        console.log('Quiz page detected');
    }
});

// Initialize course selection page
function initCourseSelection() {
    console.log('Initializing course selection');
    
    // Add click handlers to course cards
    document.querySelectorAll('.course-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const courseId = card.dataset.course;
            console.log('Selected course:', courseId);
            // For now, just log the selection
            // In a real app, this would navigate to the course page
        });
    });
}

// Utility functions that will be used by course modules
const utils = {
    // Load a JSON file
    async loadJSON(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error loading JSON:', error);
            throw error;
        }
    },
    
    // Shuffle an array
    shuffle(array) {
        return array.sort(() => Math.random() - 0.5);
    },
    
    // Format time in seconds to MM:SS
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
};

// Export the utils so they can be used by course modules
export { utils };
