'use script';

var gulp = require('gulp');
var zip = require('gulp-zip');

gulp.task('default', ['dist']);

gulp.task('dist', function () {
    return gulp.src('clipboard@ganss.org/**/*')
        .pipe(zip('clipboard.xpi'))
        .pipe(gulp.dest('.'));
})
