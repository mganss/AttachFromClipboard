import gulp from 'gulp';
import zip from 'gulp-zip';

function dist() {
    return gulp.src('clipboard@ganss.org/**/*')
        .pipe(zip('clipboard.xpi'))
        .pipe(gulp.dest('.'));
}

gulp.task('dist', dist);
gulp.task('default', gulp.series('dist'));
