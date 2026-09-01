export const validateAuth = (isLogin, data) => {
    const errors = {};
    if (!data.username || data.username.trim() === '') {
        errors.username = 'Username is required';
    } else if (data.username.trim().length < 3) {
        errors.username = 'Username must be at least 3 characters';
    }

    if (!data.password || data.password.trim() === '') {
        errors.password = 'Password is required';
    } else if (data.password.length < 6) {
        errors.password = 'Password must be at least 6 characters';
    }

    if (!isLogin) {
        if (!data.residency || data.residency.trim() === '') {
            errors.residency = 'Residency is required';
        }
    }
    return errors;
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export const validatePost = (file, caption, category) => {
    const errors = {};
    if (!file) {
        errors.media = 'Media file is required';
    } else if (file.size > MAX_FILE_SIZE) {
        errors.media = 'File size must be less than 50MB';
    } else if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        errors.media = 'Only image or video files are allowed';
    }

    if (!caption || caption.trim() === '') {
        errors.caption = 'Caption is required';
    } else if (caption.length > 500) {
        errors.caption = 'Caption must be 500 characters or fewer';
    }

    if (!category || category.trim() === '') {
        errors.category = 'Category is required';
    }

    return errors;
};
