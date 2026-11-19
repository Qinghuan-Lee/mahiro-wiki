export const postHashPrefix = '#post/';

export function postLink(post) {
  return postHashPrefix + post.id;
}
