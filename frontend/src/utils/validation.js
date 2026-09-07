import * as Yup from 'yup';

// Collects every field error (not just the first) into a flat { field: message }
// object, matching the shape Auth.jsx / CreatePost.jsx / Profile.jsx already read
// (errors.username, errors.media, etc.) so no page needed to change its error handling.
function collectErrors(schema, data) {
    try {
        schema.validateSync(data, { abortEarly: false });
        return {};
    } catch (err) {
        const errors = {};
        (err.inner.length ? err.inner : [err]).forEach((e) => {
            if (e.path && !errors[e.path]) errors[e.path] = e.message;
        });
        return errors;
    }
}

const authSchema = (isLogin) => Yup.object({
    username: Yup.string().trim()
        .required('Username is required')
        .min(3, 'Username must be at least 3 characters'),
    password: Yup.string()
        .required('Password is required')
        .min(6, 'Password must be at least 6 characters'),
    residency: isLogin
        ? Yup.string().notRequired()
        : Yup.string().trim().required('Residency is required')
});

export const validateAuth = (isLogin, data) => collectErrors(authSchema(isLogin), data);

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const postSchema = Yup.object({
    media: Yup.mixed()
        .required('Media file is required')
        .test('fileSize', 'File size must be less than 50MB', (file) => !file || file.size <= MAX_FILE_SIZE)
        .test(
            'fileType',
            'Only image or video files are allowed',
            (file) => !file || file.type.startsWith('image/') || file.type.startsWith('video/')
        ),
    caption: Yup.string().trim()
        .required('Caption is required')
        .max(500, 'Caption must be 500 characters or fewer'),
    category: Yup.string().trim().required('Category is required')
});

export const validatePost = (file, caption, category) => collectErrors(postSchema, { media: file, caption, category });

const residencySchema = Yup.object({
    residency: Yup.string().trim().required('Residency is required')
});

// Used by Profile.jsx's residency-update form; returns a single message (that page
// only ever shows one error at a time) instead of the multi-field object shape above.
export function validateResidency(residency) {
    const errors = collectErrors(residencySchema, { residency });
    return errors.residency || '';
}
