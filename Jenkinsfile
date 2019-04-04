@Library('pipeline-utils')_

def name = 'marketplace-kit'

pipeline {
  agent any

  environment {
    PROJECT_NAME = "${env.BRANCH_NAME}-${env.GIT_COMMIT[0..5]}-${env.BUILD_ID}"
  }

  stages {
    stage('Test') {
      agent { docker { image "node:10-alpine"; args '-u root' } }

      steps {
        sh 'npm install'
        sh 'npm run test'
      }
    }

    stage('Build') {
      when {
        branch 'master'
      }
      steps {
        script {
          docker.withRegistry('https://registry.hub.docker.com', 'posops-dockerhub') {
            def image = docker.build("platformos/${name}")
            image.push()
          }
        }
      }
    }
  }
  post {
    success {
      notify("${name}-pipeline ${env.PROJECT_NAME} Success after ${buildDuration()}.")
    }

    failure {
      alert("${name}-pipeline ${env.PROJECT_NAME} Failed after ${buildDuration()}.")
    }
  }
}
