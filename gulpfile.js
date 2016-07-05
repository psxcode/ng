"use strict";
var gulp = require('gulp');
var jasmine = require('gulp-jasmine');

gulp.task('test_gtor_singular_sync', function () {
	return gulp
		.src('./test/gtor_singular_sync.js')
		.pipe(jasmine());
});

gulp.task('test_gtor_singular_async', function () {
	return gulp
		.src('./test/gtor_singular_async.js')
		.pipe(jasmine());
});

gulp.task('test_gtor_iterator_cps', function () {
	return gulp
		.src('./test/gtor_iterator_cps.js')
		.pipe(jasmine());
});

gulp.task('test_gtor_iterator_direct', function () {
	return gulp
		.src('./test/gtor_iterator_direct.js')
		.pipe(jasmine());
});

gulp.task('test_cps', function () {
	return gulp
		.src('./test/cps.js')
		.pipe(jasmine());
});