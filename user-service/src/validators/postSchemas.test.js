const mongoose = require('mongoose');
const { postIdParamsSchema, createPostSchema, interactBodySchema } = require('./postSchemas');
const { ResponseMessage } = require('../utils/ResponseMessage');
const { CATEGORIES, INTERACTION_TYPES } = require('../constants');

const VALID_ID = new mongoose.Types.ObjectId().toString();

describe('postIdParamsSchema', () => {
    test('accepts a valid Mongo ObjectId', () => {
        const { error } = postIdParamsSchema.validate({ postId: VALID_ID });
        expect(error).toBeUndefined();
    });

    test('rejects a malformed id', () => {
        const { error } = postIdParamsSchema.validate({ postId: 'not-an-id' });
        expect(error.details[0].message).toBe(ResponseMessage.INVALID_POST_ID);
    });
});

describe('createPostSchema', () => {
    test('accepts a valid payload and trims caption', () => {
        const { error, value } = createPostSchema.validate({ caption: '  nice pic  ', category: CATEGORIES[0] });
        expect(error).toBeUndefined();
        expect(value.caption).toBe('nice pic');
    });

    test('rejects an invalid category', () => {
        const { error } = createPostSchema.validate({ caption: 'hi', category: 'NotACategory' });
        expect(error.details[0].message).toBe(ResponseMessage.CATEGORY_INVALID(CATEGORIES));
    });

    test('rejects an empty caption', () => {
        const { error } = createPostSchema.validate({ caption: '   ', category: CATEGORIES[0] });
        expect(error.details[0].message).toBe(ResponseMessage.CAPTION_REQUIRED);
    });

    test('rejects a caption over 500 characters', () => {
        const { error } = createPostSchema.validate({ caption: 'a'.repeat(501), category: CATEGORIES[0] });
        expect(error.details[0].message).toBe(ResponseMessage.CAPTION_TOO_LONG);
    });
});

describe('interactBodySchema', () => {
    test('accepts a like with no content', () => {
        const { error } = interactBodySchema.validate({ type: 'like' });
        expect(error).toBeUndefined();
    });

    test('rejects an invalid interaction type', () => {
        const { error } = interactBodySchema.validate({ type: 'share' });
        expect(error.details[0].message).toBe(ResponseMessage.INTERACTION_TYPE_INVALID(INTERACTION_TYPES));
    });

    test('requires content when type is comment', () => {
        const { error } = interactBodySchema.validate({ type: 'comment' });
        expect(error.details[0].message).toBe(ResponseMessage.COMMENT_TEXT_REQUIRED);
    });

    test('accepts a comment with content and trims it', () => {
        const { error, value } = interactBodySchema.validate({ type: 'comment', content: '  nice!  ' });
        expect(error).toBeUndefined();
        expect(value.content).toBe('nice!');
    });
});
